class DailyJournal {
    constructor() {
        this.entries = [];
        this.currentTheme = 'dark';
        this.domElements = {};
        this.editingEntryId = null;
        this.auth = {
            token: localStorage.getItem('authToken') || null,
            user: JSON.parse(localStorage.getItem('authUser') || 'null'),
            mode: 'login', // or 'register'
        };
        this.quoteIndex = 0;
        this.shuffledQuotes = this.shuffleQuotes(this.getInspirationalQuotes());
        this.init();
    }

    init() {
        this.loadEntries();
        this.loadTheme();
        this.bindEvents();
        this.initNavbar();
        this.initAccount();
        this.renderEntries();
        this.updateCharCount();
        this.bindFilters();

        // Initialize quote section with delay to ensure DOM is ready
        setTimeout(() => {
            this.fetchQuote();
            this.initCursorEffects();
        }, 200);
    }

    bindEvents() {
        // Wait for DOM to be fully ready
        setTimeout(() => {
            this.domElements = {
                saveEntryBtn: document.getElementById('saveEntryBtn'),
                newQuoteBtn: document.getElementById('newQuoteBtn'),
                journalInput: document.getElementById('journalInput'),
                searchInput: document.getElementById('searchInput'),
                exportBtn: document.getElementById('exportBtn'),
                clearAllBtn: document.getElementById('clearAllBtn'),
                entriesContainer: document.getElementById('entriesContainer'),
                filterCategory: document.getElementById('filterCategory'),
                filterMood: document.getElementById('filterMood'),
                quoteCard: document.querySelector('.quote-card'),
                quickStatsBtn: document.getElementById('quickStatsBtn'),
                closeModalBtn: document.getElementById('closeModal'),
                themeButtons: document.querySelectorAll('.theme-btn'),
                likeBtn: document.getElementById('likeBtn'),
                dislikeBtn: document.getElementById('dislikeBtn'),
                quoteLikeBig: document.getElementById('quoteLikeBig'),
            };

            this.bindEventListeners();
            this.bindQuoteLikeEvents();
        }, 100);
    }

    bindEventListeners() {
        // Bind navbar events
        this.bindNavbarEvents();

        // Bind form submission
        if (this.domElements.saveEntryBtn) {
            this.domElements.saveEntryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveEntry();
            });
        }

        // Bind other events
        if (this.domElements.newQuoteBtn) {
            this.domElements.newQuoteBtn.addEventListener('click', () => this.fetchQuote());
        }

        if (this.domElements.journalInput) {
            this.domElements.journalInput.addEventListener('input', () => this.updateCharCount());
            this.domElements.journalInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEntry();
                }
            });
        }

        if (this.domElements.searchInput) {
            this.domElements.searchInput.addEventListener('input', (e) => this.filterEntries(e.target.value));
        }

        if (this.domElements.exportBtn) {
            this.domElements.exportBtn.addEventListener('click', () => this.exportEntries());
        }

        if (this.domElements.clearAllBtn) {
            this.domElements.clearAllBtn.addEventListener('click', () => this.clearAllEntries());
        }

        if (this.domElements.entriesContainer) {
            this.domElements.entriesContainer.addEventListener('click', (e) => {
                // Add ripple effect on click only if not clicking action buttons
                if (!e.target.closest('.delete-btn') && !e.target.closest('.edit-btn')) {
                    this.createRippleEffect(e);
                }

                // Handle edit button clicks
                if (e.target.closest('.edit-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryElement = e.target.closest('.journal-entry');
                    if (entryElement) {
                        const id = entryElement.getAttribute('data-id');
                        if (id) {
                            this.editEntry(id);
                        } else {
                            console.error('Invalid entry ID for editing:', entryElement.getAttribute('data-id'));
                        }
                    }
                }

                // Handle delete button clicks
                if (e.target.closest('.delete-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const entryElement = e.target.closest('.journal-entry');
                    if (entryElement) {
                        const id = entryElement.getAttribute('data-id');
                        if (id) {
                            this.deleteEntry(id);
                        } else {
                            console.error('Invalid entry ID for deletion:', entryElement.getAttribute('data-id'));
                        }
                    }
                }
            });
        }

        if (this.domElements.quickStatsBtn) {
            this.domElements.quickStatsBtn.addEventListener('click', () => this.toggleQuickStats());
        }

        if (this.domElements.closeModalBtn) {
            this.domElements.closeModalBtn.addEventListener('click', () => this.toggleQuickStats());
        }

        // Theme buttons
        if (this.domElements.themeButtons) {
            this.domElements.themeButtons.forEach(btn => {
                btn.addEventListener('click', () => this.switchTheme(btn.dataset.theme));
            });
        }

        // Entries section tab bar logic
        const tabThoughts = document.getElementById('tabThoughts');
        const tabQuotes = document.getElementById('tabQuotes');
        if (tabThoughts && tabQuotes) {
            tabThoughts.addEventListener('click', () => {
                tabThoughts.classList.add('active');
                tabQuotes.classList.remove('active');
                this.renderEntries('thoughts');
            });
            tabQuotes.addEventListener('click', () => {
                tabQuotes.classList.add('active');
                tabThoughts.classList.remove('active');
                this.renderEntries('quotes');
            });
        }

        // Overlay click-to-close for comment modal
        const commentModal = document.getElementById('quoteCommentModal');
        if (commentModal && commentModal.parentElement) {
            commentModal.parentElement.addEventListener('mousedown', (e) => {
                if (e.target === commentModal.parentElement && commentModal.style.display === 'flex') {
                    commentModal.style.display = 'none';
                    commentModal.classList.remove('active');
                    commentInput.value = '';
                    commentInput.blur();
                }
            });
        }

        // Overlay click-to-close for delete confirmation modal
        const deleteModal = document.getElementById('deleteConfirmModal');
        if (deleteModal) {
            deleteModal.addEventListener('mousedown', (e) => {
                if (e.target === deleteModal && deleteModal.style.display === 'flex') {
                    deleteModal.style.display = 'none';
                    deleteModal.classList.remove('active');
                }
            });
        }
    }

    bindQuoteLikeEvents() {
        const likeBtn = this.domElements.likeBtn;
        const dislikeBtn = this.domElements.dislikeBtn;
        const quoteCard = this.domElements.quoteCard;
        const quoteLikeBig = this.domElements.quoteLikeBig;
        const commentBtn = document.getElementById('commentBtn');
        const commentModal = document.getElementById('quoteCommentModal');
        const commentInput = document.getElementById('quoteCommentInput');
        const submitCommentBtn = document.getElementById('submitCommentBtn');
        const cancelCommentBtn = document.getElementById('cancelCommentBtn');
        let lastTap = 0;
        let likeState = false;
        let dislikeState = false;

        if (likeBtn) {
            likeBtn.onclick = () => {
                likeState = !likeState;
                dislikeState = false;
                this.updateLikeDislikeUI(likeState, dislikeState);
                // Toggle icon between outline and filled
                const icon = likeBtn.querySelector('i');
                if (likeState) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                } else {
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                }
                if (likeState) this.showBigLike();
            };
        }
        if (dislikeBtn) {
            dislikeBtn.onclick = () => {
                dislikeState = !dislikeState;
                likeState = false;
                this.updateLikeDislikeUI(likeState, dislikeState);
            };
        }
        // Comment button logic
        if (commentBtn && commentModal) {
            commentBtn.onclick = () => {
                commentModal.style.display = 'flex';
                commentInput.value = '';
                setTimeout(() => commentInput.focus(), 100);
            };
        }
        if (cancelCommentBtn && commentModal) {
            cancelCommentBtn.onclick = () => {
                commentModal.style.display = 'none';
                commentModal.classList.remove('active');
                commentInput.value = '';
                commentInput.blur();
            };
        }
        if (submitCommentBtn && commentModal) {
            submitCommentBtn.onclick = () => {
                const comment = commentInput.value.trim();
                if (!comment) {
                    commentInput.focus();
                    return;
                }
                // Save quote + comment as entry
                const quoteText = document.getElementById('quoteText').textContent.replace(/^"|"$/g, '');
                const quoteAuthor = document.getElementById('quoteAuthor').textContent.replace(/^—\s*/, '');
                this.saveQuoteCommentEntry(quoteText, quoteAuthor, comment);
                commentModal.style.display = 'none';
                commentModal.classList.remove('active');
                commentInput.value = '';
                commentInput.blur();
            };
            // Also close modal on Enter (Ctrl+Enter or Cmd+Enter)
            commentInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    submitCommentBtn.click();
                }
            });
        }
        // Double-tap/double-click for like
        if (quoteCard) {
            // Touch (mobile/tablet)
            quoteCard.addEventListener('touchend', (e) => {
                const now = new Date().getTime();
                if (now - lastTap < 400) {
                    likeState = !likeState;
                    dislikeState = false;
                    this.updateLikeDislikeUI(likeState, dislikeState);
                    const icon = likeBtn.querySelector('i');
                    if (likeState) {
                        icon.classList.remove('bi-heart');
                        icon.classList.add('bi-heart-fill');
                    } else {
                        icon.classList.remove('bi-heart-fill');
                        icon.classList.add('bi-heart');
                    }
                    this.showBigLike();
                }
                lastTap = now;
            });
            // Mouse (desktop)
            quoteCard.addEventListener('dblclick', (e) => {
                likeState = !likeState;
                dislikeState = false;
                this.updateLikeDislikeUI(likeState, dislikeState);
                const icon = likeBtn.querySelector('i');
                if (likeState) {
                    icon.classList.remove('bi-heart');
                    icon.classList.add('bi-heart-fill');
                } else {
                    icon.classList.remove('bi-heart-fill');
                    icon.classList.add('bi-heart');
                }
                this.showBigLike();
            });
        }
        // Reset like/dislike on new quote
        const newQuoteBtn = this.domElements.newQuoteBtn;
        if (newQuoteBtn) {
            newQuoteBtn.addEventListener('click', () => {
                likeState = false;
                dislikeState = false;
                this.updateLikeDislikeUI(false, false);
                const icon = likeBtn.querySelector('i');
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
            });
        }
        this.updateLikeDislikeUI(false, false);
    }

    updateLikeDislikeUI(like, dislike) {
        const likeBtn = this.domElements.likeBtn;
        if (likeBtn) likeBtn.classList.toggle('liked', !!like);
    }

    showBigLike() {
        const quoteLikeBig = this.domElements.quoteLikeBig;
        if (!quoteLikeBig) return;
        quoteLikeBig.classList.add('show');
        setTimeout(() => {
            quoteLikeBig.classList.remove('show');
        }, 700);
    }

    initCursorEffects() {
        // Re-initialize cursor effects after DOM updates
        setTimeout(() => {
            const interactiveElements = document.querySelectorAll('.header, .quote-card, .input-container, .journal-entry, .chart-item, .stats-summary');

            interactiveElements.forEach(element => {
                // Remove existing listeners to prevent duplicates
                element.removeEventListener('mousemove', this.handleMouseMove);
                element.removeEventListener('mouseleave', this.handleMouseLeave);
                element.removeEventListener('click', this.handleClick);

                // Add enhanced cursor tracking
                element.addEventListener('mousemove', (e) => this.handleMouseMove(e, element));
                element.addEventListener('mouseleave', (e) => this.handleMouseLeave(e, element));
                element.addEventListener('click', (e) => this.createRippleEffect(e));
            });
        }, 100);
    }

    handleMouseMove(e, element) {
        const rect = element.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        element.style.setProperty('--mouse-x', x + '%');
        element.style.setProperty('--mouse-y', y + '%');

        // Add dynamic color reflection
        const hue = (x + y) % 360;
        element.style.setProperty('--dynamic-hue', hue);
    }

    handleMouseLeave(e, element) {
        element.style.setProperty('--mouse-x', '50%');
        element.style.setProperty('--mouse-y', '50%');
        element.style.setProperty('--dynamic-hue', '240');
    }

    createRippleEffect(e) {
        const element = e.currentTarget;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('span');

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        ripple.classList.add('ripple-effect');

        element.appendChild(ripple);

        setTimeout(() => {
            if (ripple && ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    bindFilters() {
        // Use setTimeout to ensure DOM elements are available
        setTimeout(() => {
            const filterCategory = this.domElements.filterCategory || document.getElementById('filterCategory');
            const filterMood = this.domElements.filterMood || document.getElementById('filterMood');
            const searchInput = this.domElements.searchInput || document.getElementById('searchInput');

            if (filterCategory) {
                filterCategory.addEventListener('change', () => {
                    console.log('Category filter changed:', filterCategory.value);
                    this.filterEntries();
                });
            }

            if (filterMood) {
                filterMood.addEventListener('change', () => {
                    console.log('Mood filter changed:', filterMood.value);
                    this.filterEntries();
                });
            }

            if (searchInput) {
                // Add debounced search for better performance
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        console.log('Search input changed:', e.target.value);
                        this.filterEntries(e.target.value);
                    }, 300);
                });
            }
        }, 200);
    }

    async loadEntries() {
        if (!this.auth.token) {
            this.entries = [];
            this.renderEntries();
            this.renderStats(); // Ensure stats update when no entries
            return;
        }
        try {
            const res = await fetch('http://localhost:5000/api/entries', {
                headers: { 'Authorization': `Bearer ${this.auth.token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch entries');
            this.entries = await res.json();
        } catch (error) {
            this.entries = [];
            this.showNotification('Could not load entries from server', 'error');
        }
        this.renderEntries();
        this.renderStats(); // Ensure stats update after loading entries
    }

    loadTheme() {
        try {
            const stored = localStorage.getItem('journalTheme');
            this.currentTheme = stored || 'dark';
            this.applyTheme(this.currentTheme);
        } catch (error) {
            console.error('Error loading theme:', error);
            this.currentTheme = 'dark';
            this.applyTheme(this.currentTheme);
        }
    }

    switchTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        this.showNotification(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme activated`, 'info');
    }

    applyTheme(theme) {
        try {
            document.documentElement.setAttribute('data-theme', theme);

            // Wait for DOM to be ready before updating theme buttons
            setTimeout(() => {
                const themeButtons = document.querySelectorAll('.theme-btn');
                if (themeButtons && themeButtons.length > 0) {
                    themeButtons.forEach(btn => {
                        if (btn && btn.dataset) {
                            btn.classList.remove('active');
                            if (btn.dataset.theme === theme) {
                                btn.classList.add('active');
                            }
                        }
                    });
                } else {
                    console.warn('Theme buttons not found in DOM yet, will retry...');
                    // Retry after a longer delay if buttons aren't found
                    setTimeout(() => {
                        const retryButtons = document.querySelectorAll('.theme-btn');
                        if (retryButtons && retryButtons.length > 0) {
                            retryButtons.forEach(btn => {
                                if (btn && btn.dataset) {
                                    btn.classList.remove('active');
                                    if (btn.dataset.theme === theme) {
                                        btn.classList.add('active');
                                    }
                                }
                            });
                        }
                    }, 500);
                }
            }, 100);
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    async saveEntry() {
        const input = this.domElements.journalInput;
        if (!input) return;
        const content = input.value.trim();
        const titleEl = document.getElementById('entryTitle');
        const categoryEl = document.getElementById('category');
        const tagsEl = document.getElementById('tags');
        const moodEl = document.getElementById('mood');
        const imageUploadEl = document.getElementById('imageUpload');
        const title = titleEl ? titleEl.value.trim() : '';
        const category = categoryEl ? categoryEl.value : 'Personal';
        const tags = tagsEl ? tagsEl.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        const mood = moodEl ? moodEl.value : 'Neutral';
        const image = imageUploadEl && imageUploadEl.files.length > 0 ? this.handleImageUpload(imageUploadEl.files[0]) : null;
        if (!content) {
            this.showNotification('Please write something before saving!', 'warning');
            input.focus();
            return;
        }
        if (content.length > 1000) {
            this.showNotification('Entry exceeds maximum length of 1000 characters', 'error');
            return;
        }
        let entryData = {
            title: title || 'Untitled Entry',
            content,
            category,
            tags,
            mood,
            image,
            date: new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }),
            time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            })
        };
        try {
            if (this.editingEntryId) {
                // Update existing entry
                const res = await fetch(`http://localhost:5000/api/entries/${this.editingEntryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.auth.token}`
                    },
                    body: JSON.stringify(entryData)
                });
                if (!res.ok) throw new Error('Failed to update entry');
                this.showNotification('Entry updated successfully! ✨', 'success');
                this.editingEntryId = null;
                const saveBtn = this.domElements.saveEntryBtn;
                if (saveBtn) {
                    saveBtn.textContent = 'Save Entry';
                    saveBtn.classList.remove('btn-editing');
                }
            } else {
                // Create new entry
                const res = await fetch('http://localhost:5000/api/entries', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.auth.token}`
                    },
                    body: JSON.stringify(entryData)
                });
                if (!res.ok) throw new Error('Failed to save entry');
                this.showNotification('Entry saved successfully! ✨', 'success');
            }
            await this.loadEntries();
        } catch (error) {
            this.showNotification('Could not save entry', 'error');
        }
        // Clear form
        input.value = '';
        if (titleEl) titleEl.value = '';
        if (tagsEl) tagsEl.value = '';
        if (moodEl) moodEl.value = 'Happy';
        if (imageUploadEl) imageUploadEl.value = '';
        this.updateCharCount();
        this.animateSaveButton();
    }

    handleImageUpload(file) {
        if (!file.type.match('image.*')) {
            this.showNotification('Please upload an image file', 'warning');
            return null;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.showNotification('Image size should be less than 2MB', 'warning');
            return null;
        }

        return URL.createObjectURL(file);
    }

    animateSaveButton() {
        const saveBtn = this.domElements.saveEntryBtn;
        if (saveBtn) {
            saveBtn.classList.add('save-success');
            setTimeout(() => saveBtn.classList.remove('save-success'), 800);
        }
    }

    editEntry(id) {
        const entry = this.entries.find(entry => entry._id === id);
        if (!entry) {
            this.showNotification('Entry not found', 'error');
            return;
        }

        // Fill the form with current entry data
        const titleEl = document.getElementById('entryTitle');
        const contentEl = document.getElementById('journalInput');
        const categoryEl = document.getElementById('category');
        const tagsEl = document.getElementById('tags');
        const moodEl = document.getElementById('mood');

        if (titleEl) titleEl.value = entry.title;
        if (contentEl) contentEl.value = entry.content;
        if (categoryEl) categoryEl.value = entry.category;
        if (tagsEl) tagsEl.value = entry.tags.join(', ');
        if (moodEl) moodEl.value = entry.mood;

        // Update character count
        this.updateCharCount();

        // Store the editing entry ID
        this.editingEntryId = id;

        // Update save button text
        const saveBtn = this.domElements.saveEntryBtn;
        if (saveBtn) {
            saveBtn.textContent = 'Update Entry';
            saveBtn.classList.add('btn-editing');
        }

        // Scroll to the form
        const writeSection = document.getElementById('write');
        if (writeSection) {
            writeSection.scrollIntoView({ behavior: 'smooth' });
        }

        this.showNotification('Entry loaded for editing', 'info');
    }

    async deleteEntry(id) {
        const modal = document.getElementById('deleteConfirmModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        if (!modal || !confirmBtn || !cancelBtn) return;
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        modal.classList.add('active');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        confirmBtn.onclick = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/entries/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.auth.token}` }
                });
                if (!res.ok) throw new Error('Failed to delete entry');
                this.showNotification('Entry deleted', 'info');
                await this.loadEntries();
            } catch (error) {
                this.showNotification('Could not delete entry', 'error');
            }
            modal.style.display = 'none';
            modal.classList.remove('active');
            confirmBtn.blur();
        };
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            modal.classList.remove('active');
            cancelBtn.blur();
        };
    }

    clearAllEntries() {
        if (this.entries.length === 0) {
            this.showNotification('No entries to clear', 'info');
            return;
        }

        if (confirm('Are you sure you want to delete ALL entries? This cannot be undone.')) {
            this.entries = [];
            this.showNotification('All entries cleared', 'info');
        }
    }

    filterEntries(searchQuery = '') {
        const container = this.domElements.entriesContainer || document.getElementById('entriesContainer');
        const searchInput = this.domElements.searchInput || document.getElementById('searchInput');
        const filterCategory = this.domElements.filterCategory || document.getElementById('filterCategory');
        const filterMood = this.domElements.filterMood || document.getElementById('filterMood');

        if (!container) return;

        searchQuery = searchQuery || (searchInput ? searchInput.value.toLowerCase() : '');
        const selectedCategory = filterCategory ? filterCategory.value.toLowerCase() : '';
        const selectedMood = filterMood ? filterMood.value.toLowerCase() : '';

        const entries = container.querySelectorAll('.journal-entry');
        let visibleCount = 0;

        entries.forEach(entry => {
            const content = entry.querySelector('.entry-content')?.textContent.toLowerCase() || '';
            const title = entry.querySelector('.entry-title')?.textContent.toLowerCase() || '';
            const date = entry.querySelector('.entry-date')?.textContent.toLowerCase() || '';
            const category = entry.getAttribute('data-category')?.toLowerCase() || '';
            const mood = entry.getAttribute('data-mood')?.toLowerCase() || '';

            // Check search match (title, content, or date)
            const matchesSearch = !searchQuery.trim() || 
                content.includes(searchQuery) || 
                title.includes(searchQuery) || 
                date.includes(searchQuery);

            // Check category filter
            const matchesCategory = !selectedCategory || category === selectedCategory;

            // Check mood filter  
            const matchesMood = !selectedMood || mood === selectedMood;

            const shouldShow = matchesSearch && matchesCategory && matchesMood;

            if (shouldShow) {
                entry.style.display = 'block';
                visibleCount++;
            } else {
                entry.style.display = 'none';
            }
        });

        // Show message if no entries match
        const existingMessage = container.querySelector('.filter-no-results');
        if (existingMessage) {
            existingMessage.remove();
        }

        if (visibleCount === 0 && entries.length > 0) {
            const noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'filter-no-results';
            noResultsMsg.innerHTML = '<p class="no-entries">No entries match your current filters. Try adjusting your search criteria.</p>';
            container.appendChild(noResultsMsg);
        }
    }

    exportEntries() {
        if (this.entries.length === 0) {
            this.showNotification('No entries to export', 'warning');
            return;
        }

        let exportText = '📖 MY DAILY JOURNAL\n';
        exportText += '='.repeat(52) + '\n\n';

        this.entries.forEach((entry, index) => {
            exportText += `Entry ${this.entries.length - index}: ${entry.title}\n`;
            exportText += `Category: ${entry.category}\n`;
            exportText += `Tags: ${entry.tags.join(', ') || 'None'}\n`;
            exportText += `Mood: ${entry.mood || 'Not specified'}\n`;
            exportText += `Date: ${entry.date} at ${entry.time}\n`;
            exportText += '-'.repeat(30) + '\n';
            exportText += `${entry.content}\n\n`;
        });

        exportText += `\nExported on: ${new Date().toLocaleDateString()}\n`;
        exportText += `Total entries: ${this.entries.length}`;

        this.downloadFile(exportText, `my-daily-journal-${new Date().toISOString().split('T')[0]}.txt`);
        this.showNotification('Journal exported successfully! 📄', 'success');
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    renderEntries(filterType) {
        const container = this.domElements.entriesContainer || document.getElementById('entriesContainer');
        if (!container) return;
        let entriesToShow = this.entries;
        if (filterType === 'thoughts') {
            // Only show entries that are NOT Quote Reflection
            entriesToShow = this.entries.filter(e => e.category !== 'Quote' && e.title !== 'Quote Reflection');
        } else if (filterType === 'quotes') {
            // Only show Quote Reflection entries
            entriesToShow = this.entries.filter(e => e.category === 'Quote' || e.title === 'Quote Reflection');
        }
        if (entriesToShow.length === 0) {
            container.innerHTML = '<div class="no-entries">No entries found.</div>';
            this.renderStats(); // Update stats if filter changes
            return;
        }
        container.innerHTML = entriesToShow.map(entry => this.createEntryHTML(entry)).join('');
        this.renderStats(); // Update stats after rendering
    }

    createEntryHTML(entry) {
        let quoteBlock = '';
        if (entry.quote) {
            quoteBlock = `<div class="entry-quote-block"><blockquote>“${entry.quote}”</blockquote><div class="entry-quote-author">— ${entry.quoteAuthor || 'Unknown'}</div></div>`;
        }
        return `
            <div class="journal-entry" data-id="${entry._id}" data-category="${entry.category.toLowerCase()}" data-mood="${entry.mood.toLowerCase()}">
                <div class="entry-header">
                    <div class="entry-title-section">
                        <h3 class="entry-title">${entry.title}</h3>
                        <span class="entry-date">📅 ${entry.date} • 🕒 ${entry.time}</span>
                    </div>
                    <div class="entry-actions">
                        <button class="edit-btn" title="Edit entry" aria-label="Edit entry">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="delete-btn" title="Delete entry" aria-label="Delete entry">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </div>
                ${quoteBlock}
                <div class="entry-content">${this.formatContent(entry.content)}</div>
                <div class="entry-meta">
                    <span class="entry-category">📁 ${entry.category}</span>
                    <span class="entry-tags">🏷️ ${entry.tags.join(', ') || 'None'}</span>
                    <span class="entry-mood">😊 ${entry.mood || 'Not specified'}</span>
                    ${entry.image ? `<img src="${entry.image}" alt="Entry image" class="entry-image" loading="lazy">` : ''}
                </div>
            </div>
        `;
    }

    formatContent(content) {
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\b(https?:\/\/\S+)/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    updateCharCount() {
        const input = this.domElements.journalInput;
        const counter = document.getElementById('charCount');
        const saveBtn = this.domElements.saveEntryBtn;

        if (!input || !counter || !saveBtn) return;

        const length = input.value.length;
        const maxLength = 1000;

        counter.textContent = `${length}/${maxLength} characters`;

        if (length > maxLength) {
            counter.style.color = 'var(--error-color)';
            saveBtn.disabled = true;
        } else if (length > maxLength * 0.9) {
            counter.style.color = 'var(--warning-color)';
            saveBtn.disabled = false;
        } else if (length > maxLength * 0.7) {
            counter.style.color = 'var(--warning-color)';
            saveBtn.disabled = false;
        } else {
            counter.style.color = 'var(--text-secondary)';
            saveBtn.disabled = length === 0;
        }
    }

    getInspirationalQuotes() {
        // 150+ unique, high-quality inspirational/motivational quotes
        return [
            { quote: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
            { quote: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
            { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
            { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
            { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
            { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
            { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
            { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
            { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
            { quote: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
            { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
            { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
            { quote: "Great things never come from comfort zones.", author: "Unknown" },
            { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
            { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
            { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
            { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
            { quote: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
            { quote: "Life is 10% what happens to you and 90% how you react to it.", author: "Charles R. Swindoll" },
            { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
            { quote: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
            { quote: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
            { quote: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
            { quote: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain" },
            { quote: "Success is not the key to happiness. Happiness is the key to success.", author: "Albert Schweitzer" },
            { quote: "The mind is everything. What you think you become.", author: "Buddha" },
            { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
            { quote: "A winner is a dreamer who never gives up.", author: "Nelson Mandela" },
            { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
            { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
            { quote: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
            { quote: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
            { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
            { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
            { quote: "Success is not how high you have climbed, but how you make a positive difference to the world.", author: "Roy T. Bennett" },
            { quote: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
            { quote: "You learn more from failure than from success. Don't let it stop you. Failure builds character.", author: "Unknown" },
            { quote: "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you.", author: "Steve Jobs" },
            { quote: "Experience is a hard teacher because she gives the test first, the lesson afterwards.", author: "Vernon Law" },
            { quote: "The most difficult thing is the decision to act, the rest is merely tenacity.", author: "Amelia Earhart" },
            { quote: "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle.", author: "Christian D. Larson" },
            { quote: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.", author: "Roy T. Bennett" },
            { quote: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
            { quote: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
            { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
            { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
            { quote: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
            { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
            { quote: "Don't limit your challenges. Challenge your limits.", author: "Unknown" },
            { quote: "Perseverance is not a long race; it's many short races one after the other.", author: "Walter Elliot" },
            { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
            { quote: "If you want to lift yourself up, lift up someone else.", author: "Booker T. Washington" },
            { quote: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
            { quote: "The only thing standing between you and your goal is the story you keep telling yourself as to why you can't achieve it.", author: "Jordan Belfort" },
            { quote: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
            { quote: "Don't count the days, make the days count.", author: "Muhammad Ali" },
            { quote: "If you want to achieve greatness stop asking for permission.", author: "Unknown" },
            { quote: "Go the extra mile. It's never crowded there.", author: "Dr. Wayne D. Dyer" },
            { quote: "Little by little, one travels far.", author: "J.R.R. Tolkien" },
            { quote: "If opportunity doesn't knock, build a door.", author: "Milton Berle" },
            { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
            { quote: "The best way to get started is to quit talking and begin doing.", author: "Walt Disney" },
            { quote: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
            { quote: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
            { quote: "If you can dream it, you can do it.", author: "Walt Disney" },
            { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
            // ... (add 90+ more unique, powerful quotes here) ...
        ];
    }

    shuffleQuotes(quotes) {
        // Fisher-Yates shuffle
        let array = quotes.slice();
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    fetchQuote() {
        const quoteText = document.getElementById('quoteText');
        const quoteAuthor = document.getElementById('quoteAuthor');
        const newQuoteBtn = this.domElements.newQuoteBtn;
        const quoteCard = document.querySelector('.quote-card');

        if (!quoteText || !quoteAuthor) {
            console.error('Quote elements not found in DOM');
            return;
        }

        // Ensure quote section is visible
        const quoteSection = document.querySelector('.quote-section');
        if (quoteSection) {
            quoteSection.style.display = 'block';
            quoteSection.style.visibility = 'visible';
            quoteSection.style.opacity = '1';
        }

        // Show loading state
        if (quoteCard) {
            quoteCard.classList.remove('loaded');
            quoteCard.classList.add('loading');
            quoteCard.style.display = 'block';
            quoteCard.style.visibility = 'visible';
        }
        if (newQuoteBtn) newQuoteBtn.disabled = true;

        quoteText.textContent = 'Loading new inspiration...';
        quoteAuthor.textContent = '';

        // Display quote immediately with smooth animation
        setTimeout(() => {
            // Cycle through shuffled quotes, reshuffle when all used
            if (this.quoteIndex >= this.shuffledQuotes.length) {
                this.shuffledQuotes = this.shuffleQuotes(this.getInspirationalQuotes());
                this.quoteIndex = 0;
            }
            const selectedQuote = this.shuffledQuotes[this.quoteIndex];
            this.quoteIndex++;
            this.displayQuote(quoteText, quoteAuthor, selectedQuote);

            if (newQuoteBtn) newQuoteBtn.disabled = false;
            if (quoteCard) {
                quoteCard.classList.remove('loading');
                quoteCard.classList.add('loaded');
            }
        }, 300);
    }

    displayQuote(quoteText, quoteAuthor, quoteData) {
        const randomColor1 = this.getRandomColor();
        const randomColor2 = this.getRandomColor();
        const randomColor3 = this.getRandomColor();
        const quoteCard = document.querySelector('.quote-card');

        if (quoteCard) {
            // Create dynamic gradient with multiple colors
            const gradientAngle = Math.floor(Math.random() * 360);
            quoteCard.style.background = `linear-gradient(${gradientAngle}deg, ${randomColor1}, ${randomColor2}, ${randomColor3})`;
            quoteCard.style.backgroundSize = '400% 400%';
            quoteCard.style.animation = 'gradientShift 4s ease infinite';

            // Ensure visibility
            quoteCard.style.display = 'block';
            quoteCard.style.visibility = 'visible';
            quoteCard.style.opacity = '1';
        }

        // Smooth transition effect with scale animation
        quoteText.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        quoteAuthor.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        quoteText.style.opacity = '0';
        quoteAuthor.style.opacity = '0';
        quoteText.style.transform = 'translateY(20px) scale(0.95)';
        quoteAuthor.style.transform = 'translateY(20px) scale(0.95)';

        setTimeout(() => {
            quoteText.textContent = `"${quoteData.quote || quoteData.content}"`;
            quoteAuthor.textContent = `— ${quoteData.author || 'Unknown'}`;
            quoteText.style.opacity = '1';
            quoteAuthor.style.opacity = '1';
            quoteText.style.transform = 'translateY(0) scale(1)';
            quoteAuthor.style.transform = 'translateY(0) scale(1)';
        }, 300);
    }

    getRandomColor() {
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe',
            '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3',
            '#d299c2', '#fef9d7', '#89f7fe', '#66a6ff', '#f5f7fa', '#c3cfe2',
            '#ff9a9e', '#fecfef', '#ffecd2', '#fcb69f', '#667eea', '#764ba2',
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd',
            '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9', '#f8c471', '#82e0aa',
            '#f1948a', '#85c1e9', '#f4d03f', '#a3e4d7', '#d7bde2', '#aed6f1',
            '#fad7a0', '#a9dfbf', '#f5b7b1', '#abebc6', '#f9e79f', '#d5a6bd'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type} show`;
        notification.textContent = message;        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getStats() {
        if (this.entries.length === 0) {
            return {
                totalEntries: 0,
                totalWords: 0,
                averageWordsPerEntry: 0,
                oldestEntry: null,
                newestEntry: null,
                categories: {},
                moods: {},
                quoteReflectionCount: 0
            };
        }

        const wordCounts = this.entries.map(entry => entry.content.split(/\s+/).length);
        const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);

        const categories = {};
        const moods = {};
        let quoteReflectionCount = 0;

        this.entries.forEach(entry => {
            categories[entry.category] = (categories[entry.category] || 0) + 1;
            if (entry.mood) {
                moods[entry.mood] = (moods[entry.mood] || 0) + 1;
            }
            if (entry.category === 'Quote' || entry.title === 'Quote Reflection') {
                quoteReflectionCount++;
            }
        });

        return {
            totalEntries: this.entries.length,
            totalWords: totalWords,
            averageWordsPerEntry: Math.round(totalWords / this.entries.length),
            oldestEntry: this.entries[this.entries.length - 1]?.date || 'N/A',
            newestEntry: this.entries[0]?.date || 'N/A',
            categories: categories,
            moods: moods,
            quoteReflectionCount: quoteReflectionCount
        };
    }

    renderStats() {
        const stats = this.getStats();
        const totalEntries = document.getElementById('totalEntries');
        const totalWords = document.getElementById('totalWords');
        const avgWords = document.getElementById('avgWords');
        const oldestEntry = document.getElementById('oldestEntry');
        const newestEntry = document.getElementById('newestEntry');
        const quoteReflectionEl = document.getElementById('quoteReflectionCount');

        if (totalEntries) totalEntries.textContent = stats.totalEntries;
        if (totalWords) totalWords.textContent = stats.totalWords;
        if (avgWords) avgWords.textContent = stats.averageWordsPerEntry;
        if (oldestEntry) oldestEntry.textContent = stats.oldestEntry;
        if (newestEntry) newestEntry.textContent = stats.newestEntry;
        if (quoteReflectionEl) quoteReflectionEl.textContent = stats.quoteReflectionCount;

        if (stats.totalEntries > 0) {
            this.renderCharts(stats);
        } else {
            this.clearCharts(); // <-- Clear charts but keep canvases
        }
    }

    clearCharts() {
        const entriesChartEl = document.getElementById('entriesChart');
        if (entriesChartEl && entriesChartEl._chartInstance) {
            entriesChartEl._chartInstance.destroy();
            entriesChartEl._chartInstance = null;
        }
        const categoriesChartEl = document.getElementById('categoriesChart');
        if (categoriesChartEl && categoriesChartEl._chartInstance) {
            categoriesChartEl._chartInstance.destroy();
            categoriesChartEl._chartInstance = null;
        }
        const moodsChartEl = document.getElementById('moodsChart');
        if (moodsChartEl && moodsChartEl._chartInstance) {
            moodsChartEl._chartInstance.destroy();
            moodsChartEl._chartInstance = null;
        }
    }

    renderCharts(stats) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYear = new Date().getFullYear();
        console.log('Rendering charts for year:', currentYear);
        console.log('Entries:', this.entries);
        const entryCounts = months.map((_, i) => {
            const start = new Date(currentYear, i, 1);
            const end = new Date(currentYear, i + 1, 0);
            return this.entries.filter(entry => {
                let entryDate;
                if (entry.createdAt) {
                    entryDate = new Date(entry.createdAt);
                } else if (entry.date) {
                    entryDate = new Date(entry.date);
                } else {
                    return false;
                }
                // Log each entry's date for debugging
                console.log('Entry date:', entryDate, 'Start:', start, 'End:', end);
                return entryDate >= start && entryDate <= end;
            }).length;
        });
        console.log('Entry counts per month:', entryCounts);

        const entriesChartEl = document.getElementById('entriesChart');
        console.log('entriesChartEl:', entriesChartEl, 'Chart:', typeof Chart);
        if (entriesChartEl && typeof Chart !== 'undefined') {
            if (entriesChartEl._chartInstance) {
                entriesChartEl._chartInstance.destroy();
            }
            const chart = new Chart(entriesChartEl.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Entries per Month',
                        data: entryCounts,
                        backgroundColor: '#2563eb',
                        borderColor: '#1e293b',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: `Journal Entries by Month (${currentYear})`, font: { size: 14 } },
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Number of Entries' } },
                        x: { title: { display: true, text: 'Month' } }
                    }
                }
            });
            entriesChartEl._chartInstance = chart;
        } else {
            console.log('Chart.js not loaded or entriesChartEl missing');
        }

        const categoryLabels = Object.keys(stats.categories).map(cat => cat === 'Quote' ? 'Quote Reflection' : cat);
        const categoryData = Object.values(stats.categories);
        const categoriesChartEl = document.getElementById('categoriesChart');
        console.log('categoriesChartEl:', categoriesChartEl);
        if (categoriesChartEl && typeof Chart !== 'undefined') {
            if (categoriesChartEl._chartInstance) {
                categoriesChartEl._chartInstance.destroy();
            }
            const chart = new Chart(categoriesChartEl.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: categoryLabels,
                    datasets: [{
                        label: 'Entries by Category',
                        data: categoryData,
                        backgroundColor: ['#2563eb', '#1e40af', '#1d4ed8', '#3b82f6', '#93c5fd'],
                        borderColor: '#1e293b',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Entries by Category', font: { size: 14 } },
                        legend: { position: 'right' }
                    }
                }
            });
            categoriesChartEl._chartInstance = chart;
        } else {
            console.log('Chart.js not loaded or categoriesChartEl missing');
        }

        if (Object.keys(stats.moods).length > 0) {
            const moodLabels = Object.keys(stats.moods);
            const moodData = Object.values(stats.moods);
            const moodsChartEl = document.getElementById('moodsChart');
            console.log('moodsChartEl:', moodsChartEl);
            if (moodsChartEl && typeof Chart !== 'undefined') {
                if (moodsChartEl._chartInstance) {
                    moodsChartEl._chartInstance.destroy();
                }
                const chart = new Chart(moodsChartEl.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: moodLabels,
                        datasets: [{
                            label: 'Entries by Mood',
                            data: moodData,
                            backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                            borderColor: '#1e293b',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: true, text: 'Entries by Mood', font: { size: 14 } },
                            legend: { position: 'right' }
                        }
                    }
                });
                moodsChartEl._chartInstance = chart;
            } else {
                console.log('Chart.js not loaded or moodsChartEl missing');
            }
        }
    }

    toggleQuickStats() {
        const modal = document.getElementById('quickStatsModal');
        if (!modal) return;

        modal.classList.toggle('active');
        if (modal.classList.contains('active')) {
            const stats = this.getStats();
            const modalStats = document.getElementById('modalStats');
            if (modalStats) {
                modalStats.textContent = `
                    Total Entries: ${stats.totalEntries}
                    Total Words: ${stats.totalWords}
                    Average Words: ${stats.averageWordsPerEntry}
                `;
            }
        }
    }

    // Navbar functionality
    initNavbar() {
        this.observeSections();
        this.handleNavbarScroll();
    }

    bindNavbarEvents() {
        console.log('🔧 Initializing navbar events...');
        
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        console.log('📎 Found nav links:', navLinks.length);
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });

        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const navbarNav = document.querySelector('.navbar-nav');
        
        console.log('🍔 Mobile menu button found:', !!mobileMenuBtn);
        console.log('📱 Navbar nav found:', !!navbarNav);
        
        if (mobileMenuBtn && navbarNav) {
            console.log('✅ Setting up mobile menu toggle...');
            mobileMenuBtn.addEventListener('click', (e) => {
                console.log('🍔 Hamburger clicked!');
                e.stopPropagation();
                const isActive = mobileMenuBtn.classList.contains('active');
                
                mobileMenuBtn.classList.toggle('active');
                navbarNav.classList.toggle('active');
                
                console.log('🍔 Menu active:', !isActive);
                
                // Update ARIA attributes
                mobileMenuBtn.setAttribute('aria-expanded', !isActive);
            });
        } else {
            console.error('❌ Mobile menu elements not found!');
            console.error('Mobile button:', mobileMenuBtn);
            console.error('Navbar nav:', navbarNav);
        }

        // Close mobile menu on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const mobileBtn = document.getElementById('mobileMenuBtn');
                const nav = document.querySelector('.navbar-nav');
                if (mobileBtn && nav) {
                    mobileBtn.classList.remove('active');
                    nav.classList.remove('active');
                    mobileBtn.setAttribute('aria-expanded', 'false');
                }
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const mobileBtn = document.getElementById('mobileMenuBtn');
            const nav = document.querySelector('.navbar-nav');
            
            if (mobileBtn && nav && nav.classList.contains('active')) {
                // Check if click is outside the mobile menu and hamburger button
                if (!nav.contains(e.target) && !mobileBtn.contains(e.target)) {
                    mobileBtn.classList.remove('active');
                    nav.classList.remove('active');
                    mobileBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Close mobile menu on window resize (if switching from mobile to desktop)
        window.addEventListener('resize', () => {
            const mobileBtn = document.getElementById('mobileMenuBtn');
            const nav = document.querySelector('.navbar-nav');
            
            if (window.innerWidth > 768 && mobileBtn && nav) {
                mobileBtn.classList.remove('active');
                nav.classList.remove('active');
                mobileBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    navigateToSection(section) {
        const element = document.getElementById(section);
        if (element) {
            const navbar = document.querySelector('.navbar');
            const navbarHeight = navbar ? navbar.offsetHeight : 80;
            const elementPosition = element.offsetTop - navbarHeight - 20;

            window.scrollTo({
                top: elementPosition,
                behavior: 'smooth'
            });
        }
    }

    observeSections() {
        const sections = document.querySelectorAll('section[id], header[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('data-section') === id) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '-80px 0px -80px 0px'
        });

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    handleNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        let lastScrollY = window.scrollY;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;

            if (navbar) {
                if (currentScrollY > lastScrollY && currentScrollY > 100) {
                    navbar.style.transform = 'translateX(-50%) translateY(-100%)';
                } else {
                    navbar.style.transform = 'translateX(-50%) translateY(0)';
                }

                if (currentScrollY > 50) {
                    navbar.style.background = 'var(--surface-color)';
                    navbar.style.boxShadow = 'var(--shadow-lg)';
                } else {
                    navbar.style.background = 'var(--surface-color)';
                }
            }

            lastScrollY = currentScrollY;
        });
    }

    initAccount() {
        // DOM refs
        this.accountBtn = document.getElementById('accountBtn');
        this.accountDropdown = document.getElementById('accountDropdown');
        this.accountMenu = document.getElementById('accountMenu');
        this.accountMenuContent = document.getElementById('accountMenuContent');
        this.accountModal = document.getElementById('accountModal');
        this.accountModalTitle = document.getElementById('accountModalTitle');
        this.accountForm = document.getElementById('accountForm');
        this.accountSwitchBtn = document.getElementById('accountSwitchBtn'); // legacy, not used
        this.accountModalClose = document.getElementById('accountModalClose');
        this.accountSubmitBtn = document.getElementById('accountSubmitBtn');
        this.accountModalError = document.getElementById('accountModalError');
        this.mobileAccountBtn = document.getElementById('mobileAccountBtn');
        this.loginTabBtn = document.getElementById('loginTabBtn');
        this.registerTabBtn = document.getElementById('registerTabBtn');
        this.usernameGroup = document.getElementById('usernameGroup');
        this.passwordInput = document.getElementById('accountPassword');
        this.togglePasswordBtn = document.querySelector('.toggle-password');
        this.accountSubmitBtnText = this.accountSubmitBtn ? this.accountSubmitBtn.querySelector('.btn-text') : null;
        this.accountSubmitBtnSpinner = this.accountSubmitBtn ? this.accountSubmitBtn.querySelector('.btn-spinner') : null;
        // Tab logic
        if (this.loginTabBtn && this.registerTabBtn) {
            this.loginTabBtn.addEventListener('click', () => {
                this.auth.mode = 'login';
                this.updateAccountModal();
            });
            this.registerTabBtn.addEventListener('click', () => {
                this.auth.mode = 'register';
                this.updateAccountModal();
            });
        }
        // Password visibility toggle
        if (this.togglePasswordBtn && this.passwordInput) {
            this.togglePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const type = this.passwordInput.type === 'password' ? 'text' : 'password';
                this.passwordInput.type = type;
                this.togglePasswordBtn.innerHTML = `<i class="bi bi-eye${type === 'password' ? '' : '-slash'}"></i>`;
            });
        }
        // Floating label support for autofill
        setTimeout(() => {
            document.querySelectorAll('.floating-label-group input').forEach(input => {
                if (input.value) {
                    input.classList.add('has-value');
                }
                input.addEventListener('input', () => {
                    if (input.value) input.classList.add('has-value');
                    else input.classList.remove('has-value');
                });
            });
        }, 200);
        // Real-time validation
        const emailInput = document.getElementById('accountEmail');
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                if (!this.validateEmail(emailInput.value)) {
                    emailInput.style.borderColor = 'var(--error-color)';
                } else {
                    emailInput.style.borderColor = '';
                }
            });
        }
        if (this.passwordInput) {
            this.passwordInput.addEventListener('input', () => {
                if (this.passwordInput.value.length > 0 && this.passwordInput.value.length < 6) {
                    this.passwordInput.style.borderColor = 'var(--error-color)';
                } else {
                    this.passwordInput.style.borderColor = '';
                }
            });
        }
        // Dropdown toggle (desktop)
        if (this.accountBtn && this.accountDropdown) {
            this.accountBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.accountMenu.classList.toggle('show');
                this.accountBtn.setAttribute('aria-expanded', this.accountMenu.classList.contains('show'));
            });
            // Close dropdown on outside click
            document.addEventListener('click', (e) => {
                if (!this.accountDropdown.contains(e.target)) {
                    this.accountMenu.classList.remove('show');
                    this.accountBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }
        // Mobile: open modal from hamburger menu
        if (this.mobileAccountBtn) {
            this.mobileAccountBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAccountModal('login');
                // Close mobile menu if open
                const mobileBtn = document.getElementById('mobileMenuBtn');
                const nav = document.querySelector('.navbar-nav');
                if (mobileBtn && nav) {
                    mobileBtn.classList.remove('active');
                    nav.classList.remove('active');
                    mobileBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }
        // Modal open/close
        if (this.accountModalClose) {
            this.accountModalClose.addEventListener('click', () => this.closeAccountModal());
        }
        this.accountModal.addEventListener('click', (e) => {
            if (e.target === this.accountModal) this.closeAccountModal();
        });
        // Form submit
        if (this.accountForm) {
            this.accountForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAccountSubmit();
            });
        }
        // Render dropdown/menu
        this.renderAccountMenu();
    }

    renderAccountMenu() {
        if (!this.accountMenuContent) return;
        this.accountMenuContent.innerHTML = '';
        if (this.auth.token && this.auth.user) {
            // Logged in
            this.accountMenuContent.innerHTML = `
                <div style="padding:0.5rem 0;">👋 <b>${this.auth.user.username}</b></div>
                <button id="profileBtn">Profile</button>
                <button id="logoutBtn">Logout</button>
            `;
            setTimeout(() => {
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) logoutBtn.onclick = () => this.logout();
                const profileBtn = document.getElementById('profileBtn');
                if (profileBtn) profileBtn.onclick = () => { this.showNotification('Profile coming soon!', 'info'); };
            }, 10);
        } else {
            // Not logged in
            this.accountMenuContent.innerHTML = `
                <button id="loginBtn">Login</button>
                <button id="registerBtn">Register</button>
            `;
            setTimeout(() => {
                const loginBtn = document.getElementById('loginBtn');
                const registerBtn = document.getElementById('registerBtn');
                if (loginBtn) loginBtn.onclick = () => { this.openAccountModal('login'); this.accountMenu.classList.remove('show'); };
                if (registerBtn) registerBtn.onclick = () => { this.openAccountModal('register'); this.accountMenu.classList.remove('show'); };
            }, 10);
        }
    }

    openAccountModal(mode = 'login') {
        this.auth.mode = mode;
        this.updateAccountModal();
        this.accountModal.classList.add('active');
    }

    closeAccountModal() {
        this.accountModal.classList.remove('active');
        this.accountModalError.style.display = 'none';
        this.accountForm.reset();
    }

    updateAccountModal() {
        // Tab highlight
        if (this.loginTabBtn && this.registerTabBtn) {
            this.loginTabBtn.classList.toggle('active', this.auth.mode === 'login');
            this.registerTabBtn.classList.toggle('active', this.auth.mode === 'register');
        }
        // Username field
        if (this.usernameGroup) {
            this.usernameGroup.style.display = this.auth.mode === 'register' ? '' : 'none';
        }
        // Button text
        if (this.accountSubmitBtn) {
            this.accountSubmitBtn.textContent = this.auth.mode === 'login' ? 'Login' : 'Register';
        }
        this.accountModalError.style.display = 'none';
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async handleAccountSubmit() {
        const email = document.getElementById('accountEmail').value.trim();
        const password = document.getElementById('accountPassword').value;
        const username = document.getElementById('accountUsername').value.trim();
        this.accountModalError.style.display = 'none';
        let url = '', body = {};
        if (this.auth.mode === 'login') {
            url = 'http://localhost:5000/api/auth/login';
            body = { email, password };
        } else {
            url = 'http://localhost:5000/api/auth/register';
            body = { username, email, password };
        }
        if (this.accountSubmitBtnText && this.accountSubmitBtnSpinner) {
            this.accountSubmitBtnText.style.display = 'none';
            this.accountSubmitBtnSpinner.style.display = 'inline-flex';
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) {
                this.accountModalError.textContent = data.message || 'Authentication failed.';
                this.accountModalError.style.display = 'block';
                if (this.accountSubmitBtnText && this.accountSubmitBtnSpinner) {
                    this.accountSubmitBtnText.style.display = '';
                    this.accountSubmitBtnSpinner.style.display = 'none';
                }
                return;
            }
            if (this.auth.mode === 'login') {
                this.auth.token = data.token;
                this.auth.user = data.user;
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('authUser', JSON.stringify(data.user));
                this.showNotification('Logged in successfully!', 'success');
                this.closeAccountModal();
                this.renderAccountMenu();
            } else {
                this.showNotification('Registered successfully! Please login.', 'success');
                this.auth.mode = 'login';
                this.updateAccountModal();
            }
            if (this.accountSubmitBtnText && this.accountSubmitBtnSpinner) {
                this.accountSubmitBtnText.style.display = '';
                this.accountSubmitBtnSpinner.style.display = 'none';
            }
        } catch (err) {
            this.accountModalError.textContent = 'Server error. Please try again.';
            this.accountModalError.style.display = 'block';
            if (this.accountSubmitBtnText && this.accountSubmitBtnSpinner) {
                this.accountSubmitBtnText.style.display = '';
                this.accountSubmitBtnSpinner.style.display = 'none';
            }
        }
    }

    logout() {
        this.auth.token = null;
        this.auth.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        this.renderAccountMenu();
        this.showNotification('Logged out successfully!', 'info');
    }

    async saveQuoteCommentEntry(quote, author, comment) {
        // Save as a journal entry with a special type
        const entryData = {
            title: 'Quote Reflection',
            content: comment,
            category: 'Quote',
            tags: ['inspiration', 'quote'],
            mood: '',
            image: '',
            date: new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }),
            time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            }),
            quote: quote,
            quoteAuthor: author
        };
        try {
            const res = await fetch('http://localhost:5000/api/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.token}`
                },
                body: JSON.stringify(entryData)
            });
            if (!res.ok) throw new Error('Failed to save comment');
            this.showNotification('Comment saved with quote!', 'success');
            // Always show Commented Quotes tab after saving
            const tabQuotes = document.getElementById('tabQuotes');
            const tabThoughts = document.getElementById('tabThoughts');
            if (tabQuotes && tabThoughts) {
                tabQuotes.classList.add('active');
                tabThoughts.classList.remove('active');
            }
            await this.loadEntries();
            this.renderEntries('quotes');
            this.renderStats();
            this.filterEntries();
        } catch (error) {
            this.showNotification('Could not save comment', 'error');
        }
        // Close comment modal if open (enforce)
        const commentModal = document.getElementById('quoteCommentModal');
        if (commentModal) commentModal.style.display = 'none';
    }
}

// Initialize the app only once when DOM is loaded
if (typeof window.journal === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.journal = new DailyJournal();
        window.dailyJournalInstance = window.journal; // Use the same instance globally
        console.log('📖 Welcome to Your Daily Journal!');
        console.log('💡 Pro tip: Use Ctrl/Cmd + Enter to quickly save entries');
        console.log('🎨 Try switching between light, dark, and custom themes');
    });
}

// Loader overlay logic
window.addEventListener('DOMContentLoaded', function() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hide');
        }, 3500);
    }
});

// --- DOMContentLoaded wrapper for all render logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Observe #stats section and render charts only when visible
    const statsSection = document.getElementById('stats');
    if (statsSection) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (window.journal && typeof window.journal.getStats === 'function') {
                        const stats = window.journal.getStats();
                        window.journal.renderCharts(stats);
                    }
                }
            });
        }, { threshold: 0.2 });
        observer.observe(statsSection);
    }
});

