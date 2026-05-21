// ==UserScript==
// @name         GitHub Star Date Display
// @description  Shows when you starred a GitHub repository as a floating overlay
// @version      1.0.0
// @author       Lim Chee Aun
// @match        https://github.com/*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      github.com
// @license      MIT
// @namespace https://greasyfork.org/users/1155855
// ==/UserScript==

(function() {
    'use strict';

    // Cache management
    function getCache() {
        const cache = GM_getValue('star_date_cache', '{}');
        return JSON.parse(cache);
    }

    function getCachedStarDate(owner, repo) {
        const cache = getCache();
        const key = `${owner}/${repo}`.toLowerCase();
        return cache[key] || null;
    }

    function setCachedStarDate(owner, repo, starDate) {
        const cache = getCache();
        const key = `${owner}/${repo}`.toLowerCase();
        cache[key] = starDate;
        GM_setValue('star_date_cache', JSON.stringify(cache));
    }

    // Get GitHub username from the page
    function getGitHubUsername() {
        const userMenu = document.querySelector('meta[name="user-login"]');
        if (userMenu) {
            return userMenu.getAttribute('content');
        }

        const avatarImg = document.querySelector('img.avatar-user');
        if (avatarImg && avatarImg.alt) {
            return avatarImg.alt.replace('@', '');
        }

        return null;
    }

    // Function to extract owner and repo from URL
    function getRepoInfo() {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            return {
                owner: pathParts[0],
                repo: pathParts[1]
            };
        }
        return null;
    }

    // Function to format date
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
    const listFormat = new Intl.ListFormat(undefined, {
        style: 'long',
        type: 'conjunction'
    });

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();

        const formatted = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Calculate the detailed breakdown
        let years = now.getFullYear() - date.getFullYear();
        let months = now.getMonth() - date.getMonth();
        let days = now.getDate() - date.getDate();

        // Adjust for negative days
        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }

        // Adjust for negative months
        if (months < 0) {
            years--;
            months += 12;
        }

        // Create formatted parts using Intl.RelativeTimeFormat
        const parts = [];

        if (years > 0) {
            const formatted = rtf.formatToParts(-years, 'year')
            .map(part => part.value).join('').replace(/ago|in/, '').trim();
            parts.push(formatted);
        }
        if (months > 0) {
            const formatted = rtf.formatToParts(-months, 'month')
            .map(part => part.value).join('').replace(/ago|in/, '').trim();
            parts.push(formatted);
        }
        if (days > 0) {
            const formatted = rtf.formatToParts(-days, 'day')
            .map(part => part.value).join('').replace(/ago|in/, '').trim();
            parts.push(formatted);
        }

        // Combine with Intl.ListFormat and add "ago"
        const relativeTime = parts.length > 0
        ? `${listFormat.format(parts)} ago`
        : rtf.format(0, 'day');

        return `${formatted} (${relativeTime})`;
    }

    // Fetch star date from API with smart pagination
    function getStarDate(username, owner, repo) {
        return new Promise((resolve, reject) => {
            const searchQuery = `${owner}/${repo}`;
            const url = `https://github.com/stars/${username}?q=${encodeURIComponent(searchQuery)}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        // Parse the HTML response
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');

                        // Find the repo in the list
                        const repoLinks = doc.querySelectorAll('h3 a[href]');
                        let found = false;

                        for (const link of repoLinks) {
                            const href = link.getAttribute('href');
                            if (href === `/${owner}/${repo}`) {
                                // Found the repo! Now find the star date
                                const listItem = link.closest('li');
                                if (listItem) {
                                    // Find the relative-time element
                                    const relativeTime = listItem.querySelector('relative-time[datetime]');
                                    if (relativeTime) {
                                        const datetime = relativeTime.getAttribute('datetime');
                                        setCachedStarDate(owner, repo, datetime);
                                        resolve(datetime);
                                        found = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!found) {
                            console.log('Star date not found in search results');
                            resolve(null);
                        }
                    } else {
                        console.error('Failed to fetch stars page:', response.status);
                        resolve(null);
                    }
                },
                onerror: function(error) {
                    console.error('Request error:', error);
                    reject(error);
                }
            });
        });
    }

    // Function to add star date to the UI
    function addStarDateToUI(starDate, fromCache = false) {
        // Remove any existing date displays first
        document.querySelectorAll('.star-date-display').forEach(el => el.remove());

        // Create floating overlay
        const dateDisplay = document.createElement('div');
        dateDisplay.className = 'star-date-display';
        dateDisplay.style.position = 'fixed';
        dateDisplay.style.bottom = '20px';
        dateDisplay.style.right = '20px';
        dateDisplay.style.padding = '8px 12px';
        dateDisplay.style.fontSize = '12px';
        dateDisplay.style.color = '#24292f';
        dateDisplay.style.backgroundColor = 'rgba(255, 255, 153, 0.8)';
        dateDisplay.style.borderRadius = '999px';
        dateDisplay.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.2)';
        dateDisplay.style.pointerEvents = 'none';
        dateDisplay.style.zIndex = '9999';
        dateDisplay.textContent = `⭐ ${formatDate(starDate)}`;
        dateDisplay.title = fromCache ? 'Cached star date' : 'Star date from GitHub';

        // Append to body
        document.body.appendChild(dateDisplay);
    }

    // Main function
    async function init() {
        const username = getGitHubUsername();
        if (!username) {
            return;
        }

        const repoInfo = getRepoInfo();
        if (!repoInfo) return;

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if repo is starred
        const starringContainer = document.querySelector('.starring-container.on');
        if (!starringContainer) {
            // Not starred, remove any existing display
            document.querySelectorAll('.star-date-display').forEach(el => el.remove());
            return;
        }

        // Check cache first
        const cachedDate = getCachedStarDate(repoInfo.owner, repoInfo.repo);
        if (cachedDate) {
            addStarDateToUI(cachedDate, true);
            return;
        }

        // Not in cache, fetch by scraping stars page
        try {
            const starDate = await getStarDate(username, repoInfo.owner, repoInfo.repo);
            if (starDate) {
                addStarDateToUI(starDate, false);
            }
        } catch (error) {
            console.error('Error fetching star date:', error);
        }
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Use MutationObserver to watch for star button changes
    const observer = new MutationObserver(() => {
        // Check if we're on a repo page and if it's starred
        const starringContainer = document.querySelector('.starring-container.on');
        const existingDisplay = document.querySelector('.star-date-display');

        if (starringContainer && !existingDisplay) {
            // Star button exists and is starred, but no display yet
            init();
        } else if (!starringContainer && existingDisplay) {
            // No star button (or not starred), remove display
            existingDisplay.remove();
        }
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
