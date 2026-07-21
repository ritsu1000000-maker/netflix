(function () {
    const CODE_REGEX = /^\/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

    function $(id) { return document.getElementById(id); }

    function show(id) { $(id).classList.remove('hidden'); }
    function hide(id) { $(id).classList.add('hidden'); }

    function formatTime(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        return d.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDuration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return `${h}時間${m}分`;
        if (h > 0) return `${h}時間`;
        return `${m}分`;
    }

    function formatMmSs(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}分${String(s).padStart(2, '0')}秒`;
    }

    function showError(message) {
        if (!message) return;
        const el = $('error-banner');
        el.textContent = message;
        show('error-banner');
    }

    function hideError() {
        hide('error-banner');
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    async function api(path, options = {}) {
        const headers = {
            'Accept': 'application/json',
        };
        const method = (options.method || 'GET').toUpperCase();

        if (window.__botDetected) {
            headers['X-Bot-Detected'] = String(window.__botDetected);
            if (method !== 'GET') {
                return { ok: false, status: 403, data: { error: 'Automation detected' } };
            }
        }

        if (method !== 'GET') {
            const csrf = getCookie('nrw.csrf');
            if (csrf) {
                headers['X-CSRF-Token'] = csrf;
            }
        }
        const res = await fetch(path, {
            headers,
            ...options,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    function updateUserUI(user, isAdmin) {
        if (user) {
            const avatar = $('user-avatar');
            const fallback = $('user-avatar-fallback');
            if (user.avatar) {
                avatar.src = user.avatar;
                avatar.classList.remove('hidden');
                fallback.classList.add('hidden');
            } else {
                avatar.classList.add('hidden');
                fallback.classList.remove('hidden');
                fallback.textContent = user.username.charAt(0).toUpperCase();
            }
            show('user-menu-btn');
            hide('login-btn');
            if (isAdmin) {
                show('admin-link');
            } else {
                hide('admin-link');
            }
            loadHistory();
        } else {
            hide('user-menu-btn');
            show('login-btn');
            hide('admin-link');
        }
    }

    function toggleDropdown(showDropdown) {
        const dropdown = $('user-dropdown');
        if (showDropdown) {
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    }

    function renderHistory(items) {
        const list = $('history-list');
        if (!items || items.length === 0) {
            list.innerHTML = '<p class="text-sm text-gray-400 py-2">履歴はありません</p>';
            return;
        }
        list.innerHTML = items.map(item => {
            const codeExpired = item.codeExpired;
            const tokenExpired = item.tokenExpired;
            const codeBadge = codeExpired
                ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ショートリンク期限切れ</span>'
                : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600">ショートリンク有効</span>';
            const tokenBadge = tokenExpired
                ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">nftoken期限切れ</span>'
                : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">nftoken有効</span>';
            return `
                <div class="flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div class="min-w-0">
                        <a href="${item.shortUrl}" class="text-sm font-medium text-gray-900 hover:text-red-600 truncate block">${item.shortUrl}</a>
                        <div class="text-xs text-gray-400 mt-0.5">${formatDate(item.createdAt)}</div>
                        <div class="flex flex-wrap gap-1 mt-1.5">${codeBadge}${tokenBadge}</div>
                    </div>
                    <button class="copy-text-btn shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-red-300 text-gray-700 text-xs font-medium transition" data-text="${item.shortUrl}">コピー</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.copy-text-btn').forEach(btn => {
            btn.addEventListener('click', handleCopyText);
        });
    }

    async function loadHistory() {
        const { ok, data } = await api('/api/history');
        if (ok) {
            renderHistory(data.items);
        }
    }

    function handleCopyText(e) {
        const text = e.currentTarget.dataset.text;
        navigator.clipboard.writeText(text).then(() => {
            const original = e.currentTarget.textContent;
            e.currentTarget.textContent = 'コピー完了';
            e.currentTarget.classList.add('copy-feedback');
            setTimeout(() => {
                e.currentTarget.textContent = original;
                e.currentTarget.classList.remove('copy-feedback');
            }, 1500);
        }).catch(() => {
            showError('クリップボードへのコピーに失敗しました');
        });
    }

    let cooldownTimer = null;
    let resetTimer = null;

    function startCooldownTimer(initialSeconds) {
        if (cooldownTimer) clearInterval(cooldownTimer);
        let remaining = initialSeconds;
        $('cooldown-timer').textContent = formatMmSs(remaining);
        cooldownTimer = setInterval(() => {
            remaining -= 1;
            $('cooldown-timer').textContent = formatMmSs(remaining);
            if (remaining <= 0) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
                refreshDashboard();
            }
        }, 1000);
    }

    function startResetTimer(initialMinutes) {
        if (resetTimer) clearInterval(resetTimer);
        let remainingMinutes = initialMinutes;
        $('reset-until-card').textContent = formatDuration(remainingMinutes);
        resetTimer = setInterval(() => {
            remainingMinutes -= 1;
            if (remainingMinutes < 0) remainingMinutes = 0;
            $('reset-until-card').textContent = formatDuration(remainingMinutes);
            if (remainingMinutes <= 0) {
                clearInterval(resetTimer);
                resetTimer = null;
                refreshDashboard();
            }
        }, 60000);
    }

    async function refreshDashboard() {
        const { data: me } = await api('/api/me');
        if (me.user) {
            updateDashboard({
                remaining: me.remaining,
                resetMinutes: me.resetMinutes,
                cooldownSeconds: me.cooldownSeconds,
                plan: me.plan,
                planConfig: me.planConfig,
                canCreate: me.canCreate,
            });
        }
    }

    function updateDashboard(stats) {
        const remaining = stats.remaining;
        const resetMinutes = stats.resetMinutes;
        const cooldownSeconds = stats.cooldownSeconds;
        const planConfig = stats.planConfig;

        $('remaining-count').textContent = remaining;
        $('plan-limit').textContent = planConfig ? planConfig.limit : 5;
        $('plan-badge').textContent = planConfig ? planConfig.name : 'Normal';
        $('reset-until-card').textContent = formatDuration(resetMinutes);
        startResetTimer(resetMinutes);

        const createBtn = $('create-btn');
        const createBtnText = $('create-btn-text');
        if (remaining <= 0) {
            createBtn.disabled = true;
            createBtnText.textContent = '上限に達しました';
            $('reset-until').textContent = formatDuration(resetMinutes);
            show('limit-info');
            $('cooldown-timer').textContent = '-';
            show('upgrade-btn');
        } else if (cooldownSeconds > 0) {
            createBtn.disabled = true;
            createBtnText.textContent = 'クールダウン中';
            hide('limit-info');
            startCooldownTimer(cooldownSeconds);
            hide('upgrade-btn');
        } else {
            createBtn.disabled = false;
            createBtnText.textContent = 'リンクを取得';
            hide('limit-info');
            $('cooldown-timer').textContent = '-';
            if (stats.plan === 'normal') {
                show('upgrade-btn');
            } else {
                hide('upgrade-btn');
            }
        }
    }

    async function renderDashboard(user, stats) {
        hide('loading');
        hide('guest-view');
        hide('link-view');
        show('dashboard');
        $('dash-username').textContent = user.username;
        updateDashboard(stats);
    }

    async function renderGuest() {
        hide('loading');
        hide('dashboard');
        hide('link-view');
        show('guest-view');
    }

    async function createLink() {
        const btn = $('create-btn');
        btn.disabled = true;
        show('create-loading');
        hide('result-card');

        const { ok, data } = await api('/api/links', { method: 'POST' });
        hide('create-loading');

        if (!ok) {
            showError(data.error || 'リンクの作成に失敗しました');
            $('create-btn').disabled = false;
            $('create-btn-text').textContent = 'リンクを取得';
            return;
        }

        $('short-url').value = data.shortUrl;
        $('link-web').href = data.links.web;
        $('link-web').textContent = data.links.web;
        $('link-phone').href = data.links.phone;
        $('link-phone').textContent = data.links.phone;
        $('link-tv').href = data.links.tv;
        $('link-tv').textContent = data.links.tv;

        show('result-card');
        updateDashboard({
            remaining: data.remaining,
            resetMinutes: data.resetMinutes,
            cooldownSeconds: data.cooldownSeconds,
            plan: data.plan,
            planConfig: data.planConfig,
            canCreate: data.remaining > 0 && data.cooldownSeconds === 0,
        });
        loadHistory();
    }

    async function renderLinkView(code) {
        hide('loading');
        hide('guest-view');
        hide('dashboard');
        show('link-view');
        show('link-view-loading');
        hide('link-view-error');
        hide('link-view-content');

        const { ok, data } = await api(`/api/links/${code}`);
        hide('link-view-loading');

        if (!ok) {
            show('link-view-error');
            return;
        }

        $('landing-web').href = data.links.web;
        $('landing-web').textContent = data.links.web;
        $('landing-phone').href = data.links.phone;
        $('landing-phone').textContent = data.links.phone;
        $('landing-tv').href = data.links.tv;
        $('landing-tv').textContent = data.links.tv;
        show('link-view-content');
    }

    function handleCopy(e) {
        const targetId = e.currentTarget.dataset.target;
        const el = $(targetId);
        let text = '';
        if (el.tagName === 'A') text = el.href;
        else if (el.tagName === 'INPUT') text = el.value;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            const original = e.currentTarget.textContent;
            e.currentTarget.textContent = 'コピー完了';
            e.currentTarget.classList.add('copy-feedback');
            setTimeout(() => {
                e.currentTarget.textContent = original;
                e.currentTarget.classList.remove('copy-feedback');
            }, 1500);
        }).catch(() => {
            showError('クリップボードへのコピーに失敗しました');
        });
    }

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        if (error) showError(decodeURIComponent(error));

        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', handleCopy);
        });

        $('user-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = $('user-dropdown').classList.contains('hidden');
            toggleDropdown(isHidden);
        });
        document.addEventListener('click', () => {
            toggleDropdown(false);
        });
        $('user-dropdown').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        const path = window.location.pathname;
        const code = path.replace(/^\//, '');
        const isLinkPath = CODE_REGEX.test(path);

        // Support server link from server config
        try {
            const { data } = await api('/api/config');
            if (data.supportServer) {
                $('support-link').href = data.supportServer;
            }
        } catch (e) {
            // ignore
        }

        const { data: me } = await api('/api/me');
        updateUserUI(me.user, me.isAdmin);

        if (isLinkPath) {
            await renderLinkView(code);
        } else if (me.user) {
            await renderDashboard(me.user, {
                remaining: me.remaining,
                resetMinutes: me.resetMinutes,
                cooldownSeconds: me.cooldownSeconds,
                plan: me.plan,
                planConfig: me.planConfig,
                canCreate: me.canCreate,
            });
            $('create-btn').addEventListener('click', createLink);
        } else {
            await renderGuest();
        }
    }

    init();
})();
