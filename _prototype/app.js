// State
let currentView = 'chat';
let rightPanelOpen = true;
let isDarkMode = false; // As requested, focus on light mode by default

// Data
const chats = [
    { id: 1, name: 'Luna Nova', avatar: '1', preview: 'The neon interface looks incredible...', time: '10:42 AM', unread: 3 },
    { id: 2, name: 'Kael', avatar: '5', preview: 'I\'ll send the updated protocol later.', time: 'Yesterday', unread: 0 },
    { id: 3, name: 'Project Void', avatar: '8', preview: 'Nova: Merged the new branches.', time: 'Tuesday', unread: 12 },
    { id: 4, name: 'Zara', avatar: '14', preview: 'Sounds good to me! ✨', time: 'Monday', unread: 0 },
    { id: 5, name: 'Orion Systems', avatar: '22', preview: 'System maintenance scheduled.', time: 'Last week', unread: 1 },
    { id: 6, name: 'Lyra', avatar: '32', preview: 'Did you see the new design specs?', time: 'Mar 15', unread: 0 },
];

const messages = [
    { type: 'received', text: 'I\'ve just uploaded the new neural architectures to the shared cloud. Can you take a look at the encryption layers?', time: '10:30 AM' },
    { type: 'sent', text: 'The neon interface looks incredible. Checking the encryption nodes now. Everything seems to be oscillating at the right frequency.', time: '10:35 AM' },
    { type: 'received', text: 'This is the visual feedback loop we\'re seeing. It\'s beautiful, isn\'t it?', time: '10:42 AM' }
];

// DOM Elements
const chatListEl = document.getElementById('chat-list');
const messagesArea = document.getElementById('messages-area');
const typingIndicator = document.getElementById('typing-indicator');
const viewChat = document.getElementById('view-chat');
const viewStory = document.getElementById('view-story');
const viewCall = document.getElementById('view-call');
const viewProfile = document.getElementById('view-profile');
const storyProgressFills = document.querySelectorAll('.story-progress__fill');

// Initialization
function init() {
    renderChats();
    renderMessages();
    setupEventListeners();
    
    // Simulate typing
    setTimeout(() => {
        typingIndicator.style.display = 'none';
    }, 5000);
}

// Render functions
function renderChats() {
    chatListEl.innerHTML = '';
    chats.forEach(chat => {
        const isActive = chat.id === 1 ? 'active' : '';
        const isUnread = chat.unread > 0 ? 'unread' : '';
        const badge = chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : '';
        
        chatListEl.innerHTML += `
            <div class="chat-item ${isActive} ${isUnread}">
                <div class="chat-item__avatar">
                    <img src="https://i.pravatar.cc/48?img=${chat.avatar}" alt="${chat.name}" class="chat-item__img">
                </div>
                <div class="chat-item__content">
                    <div class="chat-item__top">
                        <span class="chat-item__name">${chat.name}</span>
                        <span class="chat-item__time">${chat.time}</span>
                    </div>
                    <div class="chat-item__bottom">
                        <span class="chat-item__preview">${chat.preview}</span>
                        ${badge}
                    </div>
                </div>
            </div>
        `;
    });
}

function renderMessages() {
    // Clear area but keep the divider
    const divider = messagesArea.querySelector('.messages-date-divider');
    messagesArea.innerHTML = '';
    if (divider) messagesArea.appendChild(divider);
    
    messages.forEach(msg => {
        const msgHtml = `
            <div class="msg ${msg.type}">
                <div class="msg__bubble">${msg.text}</div>
                <span class="msg__time">${msg.time}</span>
            </div>
        `;
        messagesArea.insertAdjacentHTML('beforeend', msgHtml);
    });
    
    // Smooth scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Global View Switcher
window.showView = function(viewName) {
    // Hide all
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
    
    // Show requested
    document.getElementById(`view-${viewName}`).classList.add('view--active');
    
    // Specific logic per view
    if (viewName === 'story') {
        startStoryProgress();
    }
}

// Navigation & Interactivity
function setupEventListeners() {
    // Toggle Right Panel
    document.getElementById('btn-toggle-profile-panel').addEventListener('click', () => {
        document.body.classList.toggle('right-panel-closed');
    });
    
    document.getElementById('btn-close-right').addEventListener('click', () => {
        document.body.classList.add('right-panel-closed');
    });
    
    // Message Input
    const msgInput = document.getElementById('message-input');
    const btnSend = document.getElementById('btn-send');
    
    function sendMessage() {
        const text = msgInput.value.trim();
        if (text) {
            messages.push({ type: 'sent', text: text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
            msgInput.value = '';
            renderMessages();
        }
    }
    
    btnSend.addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Profile Tabs
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Mock content change could go here
        });
    });
}

// Fake Story Progress
function startStoryProgress() {
    storyProgressFills.forEach(f => f.classList.remove('active', 'done'));
    storyProgressFills[0].classList.add('done');
    storyProgressFills[1].classList.add('active');
}

// Run app
document.addEventListener('DOMContentLoaded', init);
