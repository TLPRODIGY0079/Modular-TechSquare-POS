// Toast notification system for TECHSQUARE POS
import { esc } from '../utils.js';

// Show toast notification
function toast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toastEl = document.createElement("div");
    toastEl.className = `toast toast-${type}`;
    
    let icon = "info-circle";
    if (type === "success") icon = "check-circle";
    if (type === "error") icon = "exclamation-circle";
    if (type === "warning") icon = "exclamation-triangle";

    toastEl.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${esc(msg)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toastEl);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toastEl.parentElement) {
            toastEl.style.opacity = "0";
            toastEl.style.transform = "translateX(100%)";
            setTimeout(() => toastEl.remove(), 300);
        }
    }, 3000);
}

// Export for use in other modules (ES6)
export { toast };