// Desktop Environment JavaScript

let draggedItem = null;
let windows = [];
let nextWindowId = 1;

// Escape text interpolated into window markup (titles come from item names).
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Sort desktop icons by name, lay them out in a grid, and persist the
// new positions. Stored positions from the server are used on load:
// icons render at their saved x/y from the template, and this function
// only repositions them when the user explicitly sorts.
function sortDesktopIcons() {
    const container = document.getElementById('desktop-items');
    const icons = Array.from(container.querySelectorAll('.desktop-item'));

    icons.sort((a, b) => {
        const nameA = a.querySelector('span').innerText.toLowerCase();
        const nameB = b.querySelector('span').innerText.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const desktop = document.getElementById('desktop');
    const iconWidth = 80;
    const iconHeight = 100;
    const gapX = 20;
    const gapY = 20;
    const iconsPerRow = Math.max(1, Math.floor(desktop.offsetWidth / (iconWidth + gapX)));

    icons.forEach((icon, i) => {
        container.appendChild(icon);
        const x = (i % iconsPerRow) * (iconWidth + gapX);
        const y = Math.floor(i / iconsPerRow) * (iconHeight + gapY);
        moveItem(icon.dataset.id, x, y);
    });
}

// Initialize desktop
document.addEventListener('DOMContentLoaded', function() {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Add drag and drop functionality
    setupDragAndDrop();

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', function(e) {
        hideContextMenu();
        hideStartMenu();
    });
    
    // Close folder modal when pressing Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeFolderModal();
        }
    });
});

// Clock functionality
function updateClock() {
    fetch('/api/time')
        .then(response => response.json())
        .then(data => {
            document.getElementById('time').textContent = data.time;
            document.getElementById('date').textContent = data.date;
        })
        .catch(error => console.error('Error updating clock:', error));
}

// Drag and drop functionality
function setupDragAndDrop() {
    const desktop = document.getElementById('desktop');
    
    desktop.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    desktop.addEventListener('drop', function(e) {
        e.preventDefault();
        if (draggedItem) {
            const rect = desktop.getBoundingClientRect();
            const x = e.clientX - rect.left - 50; // Center the item
            const y = e.clientY - rect.top - 50;
            
            moveItem(draggedItem.dataset.id, x, y);
        }
    });
}

function handleDragStart(e) {
    draggedItem = e.target.closest('.desktop-item');
    if (draggedItem) {
        draggedItem.classList.add('dragging');
    }
}

function handleDragEnd(e) {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
}

function moveItem(itemId, x, y) {
    // Update position on server
    fetch(`/api/items/${itemId}/move`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ x: x, y: y })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Move failed: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Update position on client
            const item = document.querySelector(`[data-id="${itemId}"]`);
            if (item) {
                item.style.left = x + 'px';
                item.style.top = y + 'px';
            }
        }
    })
    .catch(error => console.error('Error moving item:', error));
}

// Item interaction
function handleItemClick(type, name, id) {
    // Single click - select item
    const items = document.querySelectorAll('.desktop-item');
    items.forEach(item => item.classList.remove('selected'));
    
    const clickedItem = document.querySelector(`[data-id="${id}"]`);
    if (clickedItem) {
        clickedItem.classList.add('selected');
    }
}

function handleItemDoubleClick(type, name, id) {
    if (type === 'folder') {
        openFolderModal(name, id);
    } else if (type === 'app') {
        openApp(name.toLowerCase().replace(/\s+/g, ''));
    }
}

// Context menu
function showContextMenu(e) {
    e.preventDefault();
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
}

function createNewFolder() {
    const name = prompt('Enter folder name:');
    hideContextMenu();
    if (!name || !name.trim()) {
        return;
    }
    fetch('/api/items', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), type: 'folder' })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Create failed: ' + response.status);
        }
        window.location.reload();
    })
    .catch(error => {
        console.error('Error creating folder:', error);
        alert('Could not create folder.');
    });
}

function refreshDesktop() {
    window.location.reload();
    hideContextMenu();
}

function openSettings() {
    openWindow('Settings', 'settings', 400, 300);
    hideContextMenu();
}

// Start menu
function toggleStartMenu() {
    const startMenu = document.getElementById('start-menu');
    startMenu.classList.toggle('hidden');
    startMenu.classList.toggle('show');
}

function hideStartMenu() {
    const startMenu = document.getElementById('start-menu');
    startMenu.classList.add('hidden');
    startMenu.classList.remove('show');
}

// Folder Modal Functions
function openFolderModal(folderName, folderId) {
    const modal = document.getElementById('folder-modal');
    const title = document.getElementById('folder-title');
    const contents = document.getElementById('folder-contents');
    
    title.textContent = folderName;
    
    // Mock folder contents - you can extend this with real data
    const folderData = getFolderContents(folderName);
    
    contents.innerHTML = '';
    folderData.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'flex flex-col items-center p-4 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors group';
        itemElement.onclick = () => handleFolderItemClick(item);
        
        const iconSvg = getFolderItemIcon(item.type, item.icon);

        // The icon SVG is a fixed template; the name is user-facing text,
        // so it goes through textContent, never innerHTML.
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'w-16 h-16 mb-2 flex items-center justify-center group-hover:scale-110 transition-transform';
        iconWrapper.innerHTML = iconSvg;
        const label = document.createElement('span');
        label.className = 'text-white text-sm text-center max-w-20 truncate';
        label.textContent = item.name;
        itemElement.append(iconWrapper, label);

        contents.appendChild(itemElement);
    });
    
    modal.classList.remove('hidden');
}

function closeFolderModal() {
    const modal = document.getElementById('folder-modal');
    modal.classList.add('hidden');
}

function getFolderContents(folderName) {
    // Mock data - you can replace this with actual API calls
    const folders = {
        'Documents': [
            { name: 'My Resume.pdf', type: 'file', icon: 'document' },
            { name: 'Project Plans', type: 'folder', icon: 'folder' },
            { name: 'Notes.txt', type: 'file', icon: 'document-text' },
            { name: 'Contracts', type: 'folder', icon: 'folder' },
            { name: 'Presentation.pptx', type: 'file', icon: 'document' },
            { name: 'Spreadsheet.xlsx', type: 'file', icon: 'document' }
        ],
        'Pictures': [
            { name: 'Vacation 2024', type: 'folder', icon: 'folder' },
            { name: 'Profile.jpg', type: 'file', icon: 'photograph' },
            { name: 'Screenshot.png', type: 'file', icon: 'photograph' },
            { name: 'Family Photos', type: 'folder', icon: 'folder' },
            { name: 'Wallpapers', type: 'folder', icon: 'folder' },
            { name: 'Desktop.jpg', type: 'file', icon: 'photograph' }
        ]
    };
    
    return folders[folderName] || [
        { name: 'Empty Folder', type: 'file', icon: 'document' }
    ];
}

function getFolderItemIcon(type, icon) {
    if (type === 'folder') {
        return `<svg class="w-12 h-12 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
        </svg>`;
    } else if (icon === 'photograph') {
        return `<svg class="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>`;
    } else {
        return `<svg class="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`;
    }
}

function handleFolderItemClick(item) {
    if (item.type === 'folder') {
        // Open subfolder
        openFolderModal(item.name, null);
    } else {
        // Open file or show file info
        alert(`Opening: ${item.name}`);
    }
}

// Application launcher
function openApp(appName) {
    hideStartMenu();
    
    switch(appName) {
        case 'calculator':
            openWindow('Calculator', 'calculator', 300, 400);
            break;
        case 'notepad':
            openWindow('Notepad', 'notepad', 600, 400);
            break;
        case 'browser':
            openWindow('Browser', 'browser', 800, 600);
            break;
        case 'terminal':
        case 'texteditor':
            openWindow(appName.charAt(0).toUpperCase() + appName.slice(1), appName, 700, 500);
            break;
        default:
            openWindow(appName, appName, 500, 400);
    }
}

// Window management
function openWindow(title, type, width = 600, height = 400) {
    const windowId = nextWindowId++;
    const window = createWindow(windowId, title, type, width, height);
    windows.push(window);
    
    // Add to taskbar
    addToTaskbar(windowId, title);
    
    // Focus the new window
    focusWindow(windowId);
}

function createWindow(id, title, type, width, height) {
    const windowsContainer = document.getElementById('windows-container');
    
    const windowElement = document.createElement('div');
    windowElement.className = 'window bg-white rounded-lg shadow-2xl border border-gray-300';
    windowElement.id = `window-${id}`;
    windowElement.style.width = width + 'px';
    windowElement.style.height = height + 'px';
    windowElement.style.left = (50 + (id * 30)) + 'px';
    windowElement.style.top = (50 + (id * 30)) + 'px';
    
    const content = getWindowContent(type, id);

    windowElement.innerHTML = `
        <div class="title-bar bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-lg"
             onmousedown="startDrag(event, ${id})">
            <div class="flex items-center space-x-3">
                <div class="flex space-x-2">
                    <div class="w-3 h-3 bg-red-500 rounded-full cursor-pointer" onclick="closeWindow(${id})"></div>
                    <div class="w-3 h-3 bg-yellow-500 rounded-full cursor-pointer" onclick="minimizeWindow(${id})"></div>
                    <div class="w-3 h-3 bg-green-500 rounded-full cursor-pointer" onclick="maximizeWindow(${id})"></div>
                </div>
                <span class="font-medium text-gray-700">${escapeHtml(title)}</span>
            </div>
        </div>
        <div class="window-content p-4 overflow-auto" style="height: calc(100% - 60px);">
            ${content}
        </div>
    `;
    
    windowsContainer.appendChild(windowElement);
    
    // Make window clickable to focus
    windowElement.addEventListener('mousedown', () => focusWindow(id));
    
    return { id, element: windowElement, title, type };
}

function getWindowContent(type, windowId) {
    switch(type) {
        case 'calculator':
            return `
                <div class="calculator bg-gray-100 p-4 rounded">
                    <div class="display bg-black text-white p-3 text-right text-xl mb-4 rounded">0</div>
                    <div class="buttons grid grid-cols-4 gap-2">
                        <button class="btn bg-gray-300 p-3 rounded hover:bg-gray-400">C</button>
                        <button class="btn bg-gray-300 p-3 rounded hover:bg-gray-400">±</button>
                        <button class="btn bg-gray-300 p-3 rounded hover:bg-gray-400">%</button>
                        <button class="btn bg-orange-500 text-white p-3 rounded hover:bg-orange-600">÷</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">7</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">8</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">9</button>
                        <button class="btn bg-orange-500 text-white p-3 rounded hover:bg-orange-600">×</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">4</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">5</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">6</button>
                        <button class="btn bg-orange-500 text-white p-3 rounded hover:bg-orange-600">−</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">1</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">2</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">3</button>
                        <button class="btn bg-orange-500 text-white p-3 rounded hover:bg-orange-600">+</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300 col-span-2">0</button>
                        <button class="btn bg-gray-200 p-3 rounded hover:bg-gray-300">.</button>
                        <button class="btn bg-orange-500 text-white p-3 rounded hover:bg-orange-600">=</button>
                    </div>
                </div>
            `;
        case 'notepad':
            return `
                <div class="notepad h-full flex flex-col">
                    <div class="toolbar flex items-center space-x-2 mb-4 pb-2 border-b">
                        <button class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">New</button>
                        <button class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Open</button>
                        <button class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Save</button>
                    </div>
                    <textarea class="flex-1 w-full border border-gray-300 rounded p-3 resize-none" 
                              placeholder="Start typing..."></textarea>
                </div>
            `;
        case 'browser':
            return `
                <div class="browser h-full flex flex-col">
                    <div class="address-bar flex items-center space-x-2 mb-4 pb-2 border-b">
                        <button class="p-2 hover:bg-gray-100 rounded">←</button>
                        <button class="p-2 hover:bg-gray-100 rounded">→</button>
                        <button class="p-2 hover:bg-gray-100 rounded">⟲</button>
                        <input type="text" class="flex-1 px-3 py-2 border border-gray-300 rounded" 
                               value="https://space-desktop.local" readonly>
                    </div>
                    <div class="browser-content flex-1 bg-gray-50 rounded p-4">
                        <h2 class="text-xl font-bold mb-4">Welcome to SPACE Browser</h2>
                        <p class="text-gray-600">This is a mock browser window. In a real implementation, 
                        you could integrate with web content or create custom app interfaces.</p>
                    </div>
                </div>
            `;
        case 'terminal':
            return `
                <div class="terminal h-full bg-black text-green-400 p-4 font-mono text-sm">
                    <div class="terminal-header mb-2">SPACE Terminal v1.0</div>
                    <div class="terminal-output mb-2">
                        <div>Last login: ${new Date().toLocaleString()}</div>
                        <div>Welcome to SPACE Desktop Environment</div>
                        <div></div>
                    </div>
                    <div class="terminal-input flex">
                        <span class="prompt">user@space:~$ </span>
                        <input type="text" class="flex-1 bg-transparent outline-none text-green-400" 
                               placeholder="Type commands here..." onkeypress="handleTerminalInput(event)">
                    </div>
                </div>
            `;
        case 'settings':
            return `
                <div class="settings">
                    <h2 class="text-xl font-bold mb-4">Settings</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Theme</label>
                            <select class="w-full p-2 border border-gray-300 rounded">
                                <option>Dark</option>
                                <option>Light</option>
                                <option>Auto</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Wallpaper</label>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="w-full h-16 bg-gradient-to-br from-blue-900 to-purple-900 rounded border-2 border-blue-500"></div>
                                <div class="w-full h-16 bg-gradient-to-br from-green-900 to-blue-900 rounded border"></div>
                                <div class="w-full h-16 bg-gradient-to-br from-purple-900 to-pink-900 rounded border"></div>
                            </div>
                        </div>
                        <div class="flex space-x-2 pt-4">
                            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                            <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" onclick="closeWindow(${windowId})">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
        case 'calendar':
            return `
                <div class="p-4">
                    <h2 class="text-xl font-bold mb-2">Calendar</h2>
                    <p class="text-gray-600">${new Date().toLocaleString()}</p>
                    <p class="text-gray-600 mt-2">This is a demo window; no events are stored.</p>
                </div>
            `;
        default:
            return `<div class="p-4"><h2 class="text-xl font-bold">${escapeHtml(type)}</h2><p>Application content goes here.</p></div>`;
    }
}

// Window drag functionality
let draggedWindow = null;
let dragOffset = { x: 0, y: 0 };

function startDrag(e, windowId) {
    draggedWindow = windowId;
    const windowElement = document.getElementById(`window-${windowId}`);
    const rect = windowElement.getBoundingClientRect();
    
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    document.addEventListener('mousemove', handleWindowDrag);
    document.addEventListener('mouseup', stopDrag);
    
    focusWindow(windowId);
}

function handleWindowDrag(e) {
    if (draggedWindow) {
        const windowElement = document.getElementById(`window-${draggedWindow}`);
        windowElement.style.left = (e.clientX - dragOffset.x) + 'px';
        windowElement.style.top = (e.clientY - dragOffset.y) + 'px';
    }
}

function stopDrag() {
    draggedWindow = null;
    document.removeEventListener('mousemove', handleWindowDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Window controls
function closeWindow(windowId) {
    const windowElement = document.getElementById(`window-${windowId}`);
    if (windowElement) {
        windowElement.remove();
        removeFromTaskbar(windowId);
        windows = windows.filter(w => w.id !== windowId);
    }
}

function minimizeWindow(windowId) {
    const windowElement = document.getElementById(`window-${windowId}`);
    if (windowElement) {
        windowElement.style.display = 'none';
        updateTaskbarButton(windowId, false);
    }
}

function maximizeWindow(windowId) {
    const windowElement = document.getElementById(`window-${windowId}`);
    if (windowElement) {
        if (windowElement.classList.contains('maximized')) {
            // Restore
            windowElement.classList.remove('maximized');
            windowElement.style.width = '600px';
            windowElement.style.height = '400px';
            windowElement.style.left = '50px';
            windowElement.style.top = '50px';
        } else {
            // Maximize
            windowElement.classList.add('maximized');
            windowElement.style.width = '100vw';
            windowElement.style.height = 'calc(100vh - 48px)';
            windowElement.style.left = '0';
            windowElement.style.top = '0';
        }
    }
}

function focusWindow(windowId) {
    // Remove focus from all windows
    windows.forEach(window => {
        window.element.classList.remove('active');
        window.element.style.zIndex = '100';
    });
    
    // Focus the selected window
    const windowElement = document.getElementById(`window-${windowId}`);
    if (windowElement) {
        windowElement.classList.add('active');
        windowElement.style.zIndex = '200';
        windowElement.style.display = 'block';
        updateTaskbarButton(windowId, true);
    }
}

// Taskbar management
function addToTaskbar(windowId, title) {
    const runningApps = document.getElementById('running-apps');
    const button = document.createElement('button');
    button.id = `taskbar-${windowId}`;
    button.className = 'taskbar-item px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600';
    button.textContent = title;
    button.onclick = () => toggleWindow(windowId);
    runningApps.appendChild(button);
}

function removeFromTaskbar(windowId) {
    const button = document.getElementById(`taskbar-${windowId}`);
    if (button) {
        button.remove();
    }
}

function updateTaskbarButton(windowId, active) {
    const button = document.getElementById(`taskbar-${windowId}`);
    if (button) {
        if (active) {
            button.classList.add('bg-blue-600');
            button.classList.remove('bg-gray-700');
        } else {
            button.classList.remove('bg-blue-600');
            button.classList.add('bg-gray-700');
        }
    }
}

function toggleWindow(windowId) {
    const windowElement = document.getElementById(`window-${windowId}`);
    if (windowElement) {
        if (windowElement.style.display === 'none') {
            focusWindow(windowId);
        } else if (windowElement.classList.contains('active')) {
            minimizeWindow(windowId);
        } else {
            focusWindow(windowId);
        }
    }
}

// Terminal functionality
function handleTerminalInput(e) {
    if (e.key === 'Enter') {
        const input = e.target;
        const command = input.value.trim();
        const output = document.querySelector('.terminal-output');
        
        // Add command to output as text, never as HTML: the command is
        // user input and must not be able to inject markup.
        const commandLine = document.createElement('div');
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = 'user@space:~$ ';
        commandLine.append(prompt, document.createTextNode(command));
        output.appendChild(commandLine);
        
        // Process command
        const response = processTerminalCommand(command);
        if (response) {
            const responseLine = document.createElement('div');
            responseLine.textContent = response;
            output.appendChild(responseLine);
        }
        
        // Clear input
        input.value = '';
        
        // Scroll to bottom
        const terminal = input.closest('.terminal');
        terminal.scrollTop = terminal.scrollHeight;
    }
}

function processTerminalCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    
    switch(cmd) {
        case 'help':
            return 'Available commands: help, clear, date, echo, ls, pwd';
        case 'clear':
            setTimeout(() => {
                document.querySelector('.terminal-output').innerHTML = '';
            }, 100);
            return '';
        case 'date':
            return new Date().toString();
        case 'echo':
            return parts.slice(1).join(' ');
        case 'ls':
            return 'Documents  Pictures  Downloads  Desktop';
        case 'pwd':
            return '/home/user';
        case '':
            return '';
        default:
            return `Command not found: ${cmd}`;
    }
}

// Calendar functionality
function showCalendar() {
    openWindow('Calendar', 'calendar', 400, 300);
}
