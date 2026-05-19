const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3006;
const SECRET_KEY = 'prodigy_social_v1_secure';

// Verify local storage directory for media uploads
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Manual CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
        return res.status(200).json({});
    }
    next();
});

// Storage for "uploads"
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'post-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Database Setup
const db = new sqlite3.Database(path.join(__dirname, 'social.sqlite'), (err) => {
    if (err) console.error('Database error:', err);
    else {
        console.log('Connected to SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT,
            password TEXT,
            avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
            bio TEXT DEFAULT 'New to Prodigy Connect!'
        )`);

        // Posts
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            content TEXT,
            image_url TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Likes
        db.run(`CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            UNIQUE(user_id, post_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES posts(id)
        )`);

        // Comments
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(post_id) REFERENCES posts(id)
        )`);

        // Follows
        db.run(`CREATE TABLE IF NOT EXISTS follows (
            follower_id INTEGER,
            following_id INTEGER,
            PRIMARY KEY(follower_id, following_id),
            FOREIGN KEY(follower_id) REFERENCES users(id),
            FOREIGN KEY(following_id) REFERENCES users(id)
        )`);

        // Notifications
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            from_user_id INTEGER,
            type TEXT, -- 'like', 'comment', 'follow'
            post_id INTEGER,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(from_user_id) REFERENCES users(id)
        )`, () => {
            seedDatabase(); // Seed after all tables are ready
        });
    });
}

function seedDatabase() {
    console.log('Seeding initial developer accounts...');
    const sameerPass = bcrypt.hashSync('sameer', 10);
    const testPass = bcrypt.hashSync('test', 10);
    
    // INSERT OR IGNORE to prevent duplicates
    db.run("INSERT OR IGNORE INTO users (id, username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?, ?)",
        [1, 'sameer chau', 'sameer@prodigy.com', sameerPass, 'https://api.dicebear.com/7.x/avataaars/svg?seed=sameer', 'Full-stack developer.'], () => {
        
        db.run("INSERT OR IGNORE INTO users (id, username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?, ?)",
            [2, 'test', 'test@test.com', testPass, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test', 'Test account.'], () => {
            
            // Check if posts exist
            db.get("SELECT COUNT(*) as count FROM posts", (err, row) => {
                if (row.count === 0) {
                    db.run("INSERT INTO posts (user_id, content, tags) VALUES (?, ?, ?)",
                        [1, "Welcome to Prodigy Connect! 🚀 This is a fully functional social platform built for your internship project.", "#ProdigyConnect #WebDev"], function() {
                        db.run("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", [2, this.lastID]);
                    });
                    
                    db.run("INSERT INTO posts (user_id, content, tags, image_url) VALUES (?, ?, ?, ?)",
                        [2, "Just finished the premium UI design. What do you think?", "#Design #UIUX", "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop"], function() {
                        db.run("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", [1, this.lastID]);
                    });
                }
            });
        });
    });
}

// --- Auth Routes ---

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
        db.run("INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)", 
            [username, email, hashedPassword, avatar], function(err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            res.json({ message: 'User registered' });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`[SOCIAL] Login attempt for: ${username}`);
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            console.error('[SOCIAL] Database error during login:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            console.warn(`[SOCIAL] Login failed: User ${username} not found`);
            return res.status(400).json({ error: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.warn(`[SOCIAL] Login failed: Invalid password for ${username}`);
            return res.status(400).json({ error: 'Invalid password' });
        }

        console.log(`[SOCIAL] Login successful: ${username}`);
        const token = jwt.sign({ id: user.id, username: user.username, avatar: user.avatar }, SECRET_KEY);
        res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar } });
    });
});

// Middleware to verify JWT
function authenticate(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- Post Routes ---

app.get('/api/posts', (req, res) => {
    const query = `
        SELECT posts.*, users.username, users.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        ORDER BY posts.created_at DESC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/explore', (req, res) => {
    // Show posts with at least 1 like, or just the most liked posts
    const query = `
        SELECT posts.*, users.username, users.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        ORDER BY likes_count DESC, posts.created_at DESC LIMIT 20`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/posts', authenticate, upload.single('image'), (req, res) => {
    const { content, tags } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    db.run("INSERT INTO posts (user_id, content, image_url, tags) VALUES (?, ?, ?, ?)",
        [req.user.id, content, image_url, tags], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Post created', id: this.lastID });
        });
});

app.post('/api/posts/:id/like', authenticate, (req, res) => {
    const post_id = req.params.id;
    db.run("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", [req.user.id, post_id], function(err) {
        if (err) {
            // If already liked, unlike it
            db.run("DELETE FROM likes WHERE user_id = ? AND post_id = ?", [req.user.id, post_id], () => {
                res.json({ liked: false });
            });
        } else {
            // Create notification for post owner
            db.get("SELECT user_id FROM posts WHERE id = ?", [post_id], (err, post) => {
                if (post && post.user_id !== req.user.id) {
                    db.run("INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, ?, ?)",
                        [post.user_id, req.user.id, 'like', post_id]);
                }
            });
            res.json({ liked: true });
        }
    });
});

app.get('/api/posts/:id/comments', (req, res) => {
    db.all(`SELECT comments.*, users.username, users.avatar 
            FROM comments JOIN users ON comments.user_id = users.id 
            WHERE post_id = ? ORDER BY comments.created_at ASC`, [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/posts/:id/comments', authenticate, (req, res) => {
    const { content } = req.body;
    db.run("INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)",
        [req.user.id, req.params.id, content], function(err) {
            // Notify post owner
            db.get("SELECT user_id FROM posts WHERE id = ?", [req.params.id], (err, post) => {
                if (post && post.user_id !== req.user.id) {
                    db.run("INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, ?, ?)",
                        [post.user_id, req.user.id, 'comment', req.params.id]);
                }
            });
            res.json({ message: 'Comment added' });
        });
});

// --- User Profile & Follow Routes ---

app.get('/api/users/:username', (req, res) => {
    db.get(`SELECT id, username, avatar, bio,
            (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) as following
            FROM users WHERE username = ?`, [req.params.username], (err, user) => {
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

app.get('/api/users/:username/posts', (req, res) => {
    db.all(`SELECT posts.*, users.username, users.avatar,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) as comments_count
            FROM posts JOIN users ON posts.user_id = users.id 
            WHERE users.username = ? ORDER BY posts.created_at DESC`, [req.params.username], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/users/:id/follow', authenticate, (req, res) => {
    const following_id = req.params.id;
    if (following_id == req.user.id) return res.status(400).json({ error: "Cannot follow yourself" });

    db.run("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)", [req.user.id, following_id], function(err) {
        if (err) {
            db.run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [req.user.id, following_id], () => {
                res.json({ following: false });
            });
        } else {
            // Notify
            db.run("INSERT INTO notifications (user_id, from_user_id, type) VALUES (?, ?, ?)",
                [following_id, req.user.id, 'follow']);
            res.json({ following: true });
        }
    });
});

app.get('/api/notifications', authenticate, (req, res) => {
    db.all(`SELECT notifications.*, users.username, users.avatar 
            FROM notifications JOIN users ON notifications.from_user_id = users.id 
            WHERE notifications.user_id = ? ORDER BY notifications.created_at DESC LIMIT 20`, 
            [req.user.id], (err, rows) => {
        res.json(rows);
    });
});

app.get('/api/suggestions', authenticate, (req, res) => {
    db.all(`SELECT id, username, avatar FROM users 
            WHERE id != ? 
            AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?) 
            LIMIT 3`, [req.user.id, req.user.id], (err, rows) => {
        res.json(rows);
    });
});

app.get('/api/trending-users', (req, res) => {
    db.all(`SELECT users.id, users.username, users.avatar,
            (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers
            FROM users ORDER BY followers DESC LIMIT 3`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/search', (req, res) => {
    const q = `%${req.query.q}%`;
    db.all(`SELECT id, username, avatar, 'user' as type FROM users WHERE username LIKE ? 
            UNION
            SELECT id, content, image_url, 'post' as type FROM posts WHERE content LIKE ? OR tags LIKE ?
            LIMIT 10`, [q, q, q], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/profile/update', authenticate, (req, res) => {
    const { bio, avatar } = req.body;
    db.run("UPDATE users SET bio = ?, avatar = ? WHERE id = ?", [bio, avatar, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profile updated' });
    });
});

app.listen(PORT, () => {
    console.log(`Prodigy Connect Social API running on port ${PORT}`);
});
