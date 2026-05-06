document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authView = document.getElementById('auth-view');
    const mainView = document.getElementById('main-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    const postsContainer = document.getElementById('posts-container');
    const notificationsContainer = document.getElementById('notifications-container');
    const notificationsList = document.getElementById('notifications-list');
    const exploreView = document.getElementById('explore-view');
    const profileView = document.getElementById('profile-view');
    const suggestionsList = document.getElementById('suggestions-list');
    const trendingUsersList = document.getElementById('trending-users-list');
    
    const postCreator = document.querySelector('.post-creator');
    const feedHeader = document.querySelector('.feed-header');

    // Profile Elements
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const profileBio = document.getElementById('profile-bio');
    const followersCount = document.getElementById('followers-count');
    const followingCount = document.getElementById('following-count');
    const followBtn = document.getElementById('follow-btn');
    const profilePosts = document.getElementById('profile-posts');

    // State
    let token = localStorage.getItem('social_token');
    let user = JSON.parse(localStorage.getItem('social_user'));
    let activePostId = null;

    if (token && user) showMain();

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const text = item.textContent.trim();
            if (text === 'Home') showHome();
            if (text === 'Explore') showExplore();
            if (text === 'Notifications') showNotifications();
            if (text === 'Profile') showUserProfile(user.username);
        });
    });

    function hideAllSections() {
        postsContainer.classList.add('hidden');
        notificationsContainer.classList.add('hidden');
        exploreView.classList.add('hidden');
        profileView.classList.add('hidden');
        postCreator.classList.add('hidden');
    }

    function showHome() {
        hideAllSections();
        postsContainer.classList.remove('hidden');
        postCreator.classList.remove('hidden');
        feedHeader.textContent = 'Home';
        fetchPosts();
    }

    async function showExplore() {
        hideAllSections();
        exploreView.classList.remove('hidden');
        feedHeader.textContent = 'Explore Trending';
        
        const res = await fetch('/api/explore');
        const posts = await res.json();
        exploreView.innerHTML = '';
        posts.forEach(p => exploreView.appendChild(createPostElement(p)));
    }

    async function showNotifications() {
        hideAllSections();
        notificationsContainer.classList.remove('hidden');
        feedHeader.textContent = 'Notifications';
        
        const res = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const notifications = await res.json();
        renderNotifications(notifications);
    }

    function renderNotifications(notifs) {
        notificationsList.innerHTML = '';
        if (notifs.length === 0) {
            notificationsList.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No notifications yet</div>';
            return;
        }
        notifs.forEach(n => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            let actionText = '';
            if (n.type === 'like') actionText = 'liked your post';
            if (n.type === 'comment') actionText = 'commented on your post';
            if (n.type === 'follow') actionText = 'started following you';

            item.innerHTML = `
                <img src="${n.avatar}" class="notification-avatar">
                <div class="notification-content">
                    <b>${n.username}</b> ${actionText}
                </div>
                <div class="notification-time">${new Date(n.created_at).toLocaleDateString()}</div>
            `;
            notificationsList.appendChild(item);
        });
    }

    async function showUserProfile(username) {
        hideAllSections();
        profileView.classList.remove('hidden');
        feedHeader.textContent = `@${username.toLowerCase()}`;

        const res = await fetch(`/api/users/${username}`);
        const profileData = await res.json();
        
        profileAvatar.src = profileData.avatar;
        profileName.textContent = profileData.username;
        profileBio.textContent = profileData.bio;
        followersCount.innerHTML = `<b>${profileData.followers}</b> Followers`;
        followingCount.innerHTML = `<b>${profileData.following}</b> Following`;

        if (profileData.username === user.username) {
            followBtn.classList.add('hidden');
            document.getElementById('edit-profile-btn').classList.remove('hidden');
            document.getElementById('edit-profile-btn').onclick = () => openEditModal(profileData);
        } else {
            followBtn.classList.remove('hidden');
            document.getElementById('edit-profile-btn').classList.add('hidden');
            followBtn.textContent = 'Follow'; 
            followBtn.onclick = () => followUser(profileData.id);
        }

        const postsRes = await fetch(`/api/users/${username}/posts`);
        const posts = await postsRes.json();
        profilePosts.innerHTML = '';
        posts.forEach(post => profilePosts.appendChild(createPostElement(post)));
    }

    async function followUser(userId) {
        const res = await fetch(`/api/users/${userId}/follow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const btn = document.querySelector(`[data-user-id="${userId}"] .btn-secondary`) || followBtn;
            if (btn) btn.textContent = data.following ? 'Unfollow' : 'Follow';
            fetchSuggestions();
            // If on profile, refresh stats
            if (!profileView.classList.contains('hidden')) {
                showUserProfile(profileName.textContent);
            }
        }
    }

    async function fetchSuggestions() {
        const res = await fetch('/api/suggestions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const suggestions = await res.json();
        suggestionsList.innerHTML = '';
        suggestions.forEach(s => {
            const item = document.createElement('div');
            item.className = 'follow-item';
            item.setAttribute('data-user-id', s.id);
            item.innerHTML = `
                <img src="${s.avatar}" onclick="window.app.showUserProfile('${s.username}')" style="cursor:pointer">
                <div onclick="window.app.showUserProfile('${s.username}')" style="cursor:pointer">
                    <div class="name">${s.username}</div>
                    <div class="handle">@${s.username.toLowerCase()}</div>
                </div>
                <button class="btn-secondary" onclick="window.app.followUser(${s.id})">Follow</button>
            `;
            suggestionsList.appendChild(item);
        });
    }

    async function fetchTrendingUsers() {
        const res = await fetch('/api/trending-users');
        const trending = await res.json();
        trendingUsersList.innerHTML = '';
        trending.forEach(u => {
            const item = document.createElement('div');
            item.className = 'follow-item';
            item.innerHTML = `
                <img src="${u.avatar}" onclick="window.app.showUserProfile('${u.username}')" style="cursor:pointer">
                <div onclick="window.app.showUserProfile('${u.username}')" style="cursor:pointer">
                    <div class="name">${u.username}</div>
                    <div class="handle">${u.followers} followers</div>
                </div>
            `;
            trendingUsersList.appendChild(item);
        });
    }

    // --- Core Logic Helpers ---
    function createPostElement(post) {
        const postEl = document.createElement('div');
        postEl.className = 'post';
        postEl.innerHTML = `
            <img src="${post.avatar}" class="post-avatar" onclick="window.app.showUserProfile('${post.username}')">
            <div class="post-content">
                <div class="post-header">
                    <span class="name" onclick="window.app.showUserProfile('${post.username}')">${post.username}</span>
                    <span class="handle">@${post.username.toLowerCase()}</span>
                    <span class="handle">· ${new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <div class="post-text">${post.content}</div>
                ${post.image_url ? `<img src="${post.image_url}" class="post-image">` : ''}
                <div class="post-actions">
                    <div class="action-item" onclick="window.app.likePost(${post.id}, this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.77-8.77 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span>${post.likes_count}</span>
                    </div>
                    <div class="action-item" onclick="window.app.openComments(${post.id})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <span>${post.comments_count}</span>
                    </div>
                </div>
            </div>
        `;
        return postEl;
    }

    window.app = {
        showUserProfile,
        followUser,
        likePost: async (postId, el) => {
            const res = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const span = el.querySelector('span');
                let count = parseInt(span.textContent);
                span.textContent = data.liked ? count + 1 : count - 1;
                el.classList.toggle('liked', data.liked);
            }
        },
        openComments: async (postId) => {
            activePostId = postId;
            document.getElementById('comments-modal').classList.remove('hidden');
            const res = await fetch(`/api/posts/${postId}/comments`);
            const comments = await res.json();
            const list = document.getElementById('comments-list');
            list.innerHTML = '';
            comments.forEach(c => {
                const cEl = document.createElement('div');
                cEl.style.display = 'flex'; cEl.style.gap = '10px'; cEl.style.marginBottom = '15px';
                cEl.innerHTML = `<img src="${c.avatar}" style="width:32px; height:32px; border-radius:50%;">
                                 <div><b style="font-size:13px;">${c.username}</b><div style="font-size:14px;">${c.content}</div></div>`;
                list.appendChild(cEl);
            });
        }
    };

    document.getElementById('show-login').onclick = () => { loginForm.classList.remove('hidden'); registerForm.classList.add('hidden'); };
    document.getElementById('show-register').onclick = () => { registerForm.classList.remove('hidden'); loginForm.classList.add('hidden'); };

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: loginForm[0].value, password: loginForm[1].value })
        });
        const data = await res.json();
        if (res.ok) { token = data.token; user = data.user; localStorage.setItem('social_token', token); localStorage.setItem('social_user', JSON.stringify(user)); showMain(); }
    };

    document.getElementById('logout-btn').onclick = () => { localStorage.clear(); location.reload(); };

    // --- Search Logic ---
    const globalSearch = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');

    globalSearch.addEventListener('input', async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        const res = await fetch(`/api/search?q=${q}`);
        const data = await res.json();
        renderSearchResults(data);
    });

    function renderSearchResults(data) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('hidden');
        if (data.length === 0) {
            searchResults.innerHTML = '<div class="p-20">No results found</div>';
            return;
        }
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <img src="${item.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Post'}" alt="">
                <div>
                    <b>${item.username || 'Post'}</b>
                    <div style="font-size:12px; color:var(--text-muted)">${item.type}</div>
                </div>
            `;
            div.onclick = () => {
                if (item.type === 'user') showUserProfile(item.username);
                searchResults.classList.add('hidden');
                globalSearch.value = '';
            };
            searchResults.appendChild(div);
        });
    }

    // --- Edit Profile Logic ---
    function openEditModal(profile) {
        document.getElementById('edit-profile-modal').classList.remove('hidden');
        document.getElementById('edit-bio').value = profile.bio;
        document.getElementById('edit-avatar').value = profile.avatar;
    }

    document.getElementById('save-profile').onclick = async () => {
        const bio = document.getElementById('edit-bio').value;
        const avatar = document.getElementById('edit-avatar').value;

        const res = await fetch('/api/profile/update', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ bio, avatar })
        });

        if (res.ok) {
            document.getElementById('edit-profile-modal').classList.add('hidden');
            // Update local user state
            user.avatar = avatar;
            localStorage.setItem('social_user', JSON.stringify(user));
            showMain();
            showUserProfile(user.username);
        }
    };

    document.getElementById('close-edit-modal').onclick = () => {
        document.getElementById('edit-profile-modal').classList.add('hidden');
    };

    function showMain() {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
        document.getElementById('current-user-name').textContent = user.username;
        document.getElementById('current-user-avatar').src = user.avatar;
        document.getElementById('creator-avatar').src = user.avatar;
        showHome();
        fetchSuggestions();
        fetchTrendingUsers();
    }

    async function fetchPosts() {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        postsContainer.innerHTML = '';
        posts.forEach(p => postsContainer.appendChild(createPostElement(p)));
    }

    document.getElementById('submit-post').onclick = async () => {
        const content = document.getElementById('post-content').value;
        const img = document.getElementById('post-image').files[0];
        const fd = new FormData();
        fd.append('content', content);
        if (img) fd.append('image', img);
        
        await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        document.getElementById('post-content').value = '';
        document.getElementById('post-image').value = '';
        fetchPosts();
    };

    document.getElementById('submit-comment').onclick = async () => {
        const content = document.getElementById('new-comment').value;
        await fetch(`/api/posts/${activePostId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content })
        });
        document.getElementById('new-comment').value = '';
        window.app.openComments(activePostId);
    };

    document.getElementById('close-modal').onclick = () => document.getElementById('comments-modal').classList.add('hidden');
});
