/**
 * Toast Notification Utility
 * Unifies toast notifications across the application with a premium design.
 */
class Toast {
    constructor() {
        this.containerId = 'global-toast-container';
        this.ensureContainer();
    }

    ensureContainer() {
        if (!document.getElementById(this.containerId)) {
            const container = document.createElement('div');
            container.id = this.containerId;
            // Fixed position, z-index high, flex column for stacking
            container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms (default 3000)
     */
    show(message, type = 'info', duration = 3000) {
        this.ensureContainer();
        const container = document.getElementById(this.containerId);

        // Create toast element
        const toast = document.createElement('div');

        // Styles based on type
        const styles = {
            success: {
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-l-4 border-green-500',
                icon: `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
                title: 'Éxito'
            },
            error: {
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-l-4 border-red-500',
                icon: `<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
                title: 'Error'
            },
            warning: {
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-l-4 border-yellow-500',
                icon: `<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
                title: 'Advertencia'
            },
            info: {
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-l-4 border-[#4EABBE]',
                icon: `<svg class="w-6 h-6 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
                title: 'Información'
            }
        };

        const style = styles[type] || styles.info;

        // Tailwind classes for premium look
        toast.className = `
            pointer-events-auto
            flex items-center gap-3 
            w-full max-w-sm 
            p-4 
            rounded-lg 
            shadow-lg 
            ${style.bg} 
            ${style.border}
            transform transition-all duration-500 ease-out
            translate-x-full opacity-0
            border border-gray-100 dark:border-gray-700
        `;

        toast.innerHTML = `
            <div class="flex-shrink-0">
                ${style.icon}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                    ${message}
                </p>
            </div>
            <button class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-500 focus:outline-none" onclick="this.parentElement.remove()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;

        container.appendChild(toast);

        // Animation In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 500); // Wait for transition to finish
        }, duration);
    }
}

// Export singleton
const toast = new Toast();
export default toast;
