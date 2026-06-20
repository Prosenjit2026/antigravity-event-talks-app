document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        releases: [],
        filteredReleases: [],
        activeFilter: 'all',
        searchQuery: '',
        selectedUpdate: null
    };

    // DOM Elements
    const elements = {
        refreshBtn: document.getElementById('refresh-btn'),
        spinnerIcon: document.getElementById('spinner-icon'),
        searchInput: document.getElementById('search-input'),
        filterContainer: document.getElementById('filter-container'),
        notesContainer: document.getElementById('notes-container'),
        selectedPreview: document.getElementById('selected-preview'),
        composerEditorBox: document.getElementById('composer-editor-box'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCountText: document.getElementById('char-count-text'),
        progressCircle: document.getElementById('progress-circle'),
        charCounter: document.querySelector('.char-counter'),
        tweetBtn: document.getElementById('tweet-btn')
    };

    // Initialize circular progress ring
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    if (elements.progressCircle) {
        elements.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        elements.progressCircle.style.strokeDashoffset = circumference;
    }

    // Load initial feed data
    fetchReleases();

    // Event Listeners
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        applyFiltersAndRender();
    });

    elements.filterContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        // Update active chip UI
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        // Update state & render
        state.activeFilter = chip.dataset.type;
        applyFiltersAndRender();
    });

    elements.tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
    });

    elements.tweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value.trim();
        if (!text) return;
        
        // Open X/Twitter Tweet Web Intent in a new tab
        const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    });

    // API Call to fetch data
    async function fetchReleases(isManual = false) {
        try {
            setLoadingState(true);
            const response = await fetch('/api/releases');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            if (data.status === 'success') {
                state.releases = data.releases;
                applyFiltersAndRender();
            } else {
                throw new Error(data.message || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            renderErrorState(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // Toggle Loading Animation
    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.spinnerIcon.classList.add('spinning');
            elements.refreshBtn.disabled = true;
            if (state.releases.length === 0) {
                elements.notesContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading latest release notes from Google Cloud...</p>
                    </div>
                `;
            }
        } else {
            elements.spinnerIcon.classList.remove('spinning');
            elements.refreshBtn.disabled = false;
        }
    }

    // Display Error Message inside the feed area
    function renderErrorState(message) {
        elements.notesContainer.innerHTML = `
            <div class="error-state">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>Failed to Load Feed</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="btn btn-primary">Try Again</button>
            </div>
        `;
    }

    // Apply active filter and text query
    function applyFiltersAndRender() {
        state.filteredReleases = state.releases.map(day => {
            const filteredUpdates = day.updates.filter(update => {
                // Filter by category type
                const matchesFilter = state.activeFilter === 'all' || 
                                     update.type.toLowerCase() === state.activeFilter;
                
                // Filter by search string
                const matchesSearch = !state.searchQuery || 
                                      update.type.toLowerCase().includes(state.searchQuery) ||
                                      update.text.toLowerCase().includes(state.searchQuery);
                                      
                return matchesFilter && matchesSearch;
            });
            
            return {
                ...day,
                updates: filteredUpdates
            };
        }).filter(day => day.updates.length > 0); // Hide days that have no updates left

        renderFeed();
    }

    // Render feed updates to HTML
    function renderFeed() {
        if (state.filteredReleases.length === 0) {
            elements.notesContainer.innerHTML = `
                <div class="empty-search-state">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>No Matches Found</h3>
                    <p>Try refining your search terms or changing your category filter.</p>
                </div>
            `;
            return;
        }

        elements.notesContainer.innerHTML = state.filteredReleases.map((day, dayIndex) => `
            <article class="day-card" id="day-card-${dayIndex}">
                <div class="day-header">
                    <h3 class="day-title">${day.date}</h3>
                    <a href="${day.link}" target="_blank" rel="noopener" class="day-source-link">
                        <span>Original Notes</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                        </svg>
                    </a>
                </div>
                <div class="day-updates">
                    ${day.updates.map((update, updateIndex) => {
                        const uniqueId = `up-${dayIndex}-${updateIndex}`;
                        const isSelected = state.selectedUpdate && 
                                           state.selectedUpdate.id === uniqueId;
                                           
                        return `
                            <div class="update-block ${isSelected ? 'selected' : ''}" 
                                 data-id="${uniqueId}" 
                                 data-day-index="${dayIndex}"
                                 data-update-index="${updateIndex}">
                                <div class="update-badge-header">
                                    <span class="type-badge ${update.type.toLowerCase()}">${update.type}</span>
                                    <button class="select-tweet-btn" id="btn-select-${uniqueId}">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
                                        </svg>
                                        <span>${isSelected ? 'Selected' : 'Select to Tweet'}</span>
                                    </button>
                                </div>
                                <div class="update-body">
                                    ${update.html}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </article>
        `).join('');

        // Add event listeners to newly rendered update cards
        document.querySelectorAll('.update-block').forEach(block => {
            block.addEventListener('click', (e) => {
                // If user clicks a link inside, let it go to the link
                if (e.target.tagName === 'A' || e.target.closest('a')) return;
                
                const uniqueId = block.dataset.id;
                const dayIdx = parseInt(block.dataset.dayIndex);
                const updateIdx = parseInt(block.dataset.updateIndex);
                
                const originalDay = state.filteredReleases[dayIdx];
                const originalUpdate = originalDay.updates[updateIdx];
                
                selectUpdate(uniqueId, originalDay, originalUpdate);
            });
        });
    }

    // Handles highlighting cards and setting up tweet drawer
    function selectUpdate(uniqueId, day, update) {
        // Toggle if already selected
        if (state.selectedUpdate && state.selectedUpdate.id === uniqueId) {
            state.selectedUpdate = null;
            renderPreviewEmpty();
            document.querySelectorAll('.update-block').forEach(b => b.classList.remove('selected'));
            document.querySelectorAll('.select-tweet-btn span').forEach(s => s.innerText = 'Select to Tweet');
            return;
        }

        state.selectedUpdate = {
            id: uniqueId,
            date: day.date,
            link: day.link,
            type: update.type,
            text: update.text
        };

        // Render card selections
        document.querySelectorAll('.update-block').forEach(b => {
            if (b.dataset.id === uniqueId) {
                b.classList.add('selected');
                const label = b.querySelector('.select-tweet-btn span');
                if (label) label.innerText = 'Selected';
            } else {
                b.classList.remove('selected');
                const label = b.querySelector('.select-tweet-btn span');
                if (label) label.innerText = 'Select to Tweet';
            }
        });

        // Set up composer pane
        renderPreviewActive(state.selectedUpdate);
        draftTweetText(state.selectedUpdate);
    }

    function renderPreviewEmpty() {
        elements.selectedPreview.innerHTML = `
            <div class="empty-preview-state">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-icon">
                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>No update selected</p>
                <span>Click "Select for Tweet" on any card to begin</span>
            </div>
        `;
        elements.composerEditorBox.classList.add('hidden');
    }

    function renderPreviewActive(selected) {
        elements.selectedPreview.innerHTML = `
            <div class="preview-active">
                <div class="preview-active-header">
                    <span class="preview-date">${selected.date}</span>
                    <span class="type-badge ${selected.type.toLowerCase()}">${selected.type}</span>
                </div>
                <p class="preview-text">${selected.text}</p>
            </div>
        `;
        elements.composerEditorBox.classList.remove('hidden');
    }

    // Auto-generates a text template for X/Twitter with intelligent truncation
    function draftTweetText(selected) {
        // Emojis based on category type
        let emoji = '📢';
        if (selected.type.toLowerCase() === 'feature') emoji = '🚀';
        else if (selected.type.toLowerCase() === 'issue') emoji = '⚠️';
        else if (selected.type.toLowerCase() === 'breaking') emoji = '🚨';
        else if (selected.type.toLowerCase() === 'change') emoji = '🔄';

        const prefix = `${emoji} BigQuery Update (${selected.date}):\n\n`;
        const suffix = `\n\nRead more: ${selected.link}`;
        
        // Target maximum tweet size is 280.
        // We calculate remaining size for the body.
        const remainingSpace = 280 - prefix.length - suffix.length;
        
        let bodyText = selected.text;
        if (bodyText.length > remainingSpace) {
            bodyText = bodyText.substring(0, remainingSpace - 3) + '...';
        }

        elements.tweetTextarea.value = `${prefix}${bodyText}${suffix}`;
        updateCharCounter();
    }

    // Circular progress & Char count updater
    function updateCharCounter() {
        const text = elements.tweetTextarea.value;
        const charCount = text.length;
        const limit = 280;
        const remaining = limit - charCount;

        elements.charCountText.innerText = remaining;

        // Circular indicator update
        if (elements.progressCircle) {
            const percent = Math.min(100, (charCount / limit) * 100);
            const offset = circumference - (percent / 100) * circumference;
            elements.progressCircle.style.strokeDashoffset = offset;
            
            // Adjust warning styling
            elements.charCounter.classList.remove('warning', 'exceeded');
            if (charCount > limit) {
                elements.charCounter.classList.add('exceeded');
                elements.tweetBtn.disabled = true;
            } else if (charCount >= limit - 20) {
                elements.charCounter.classList.add('warning');
                elements.tweetBtn.disabled = false;
            } else {
                elements.tweetBtn.disabled = false;
            }
        }
    }
});
