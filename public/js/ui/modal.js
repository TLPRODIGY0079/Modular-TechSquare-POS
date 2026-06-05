// Modal management for TECHSQUARE POS
import { $ } from '../utils.js';

// Open modal
function openModal(title, body, footer = "") {
    const modalOverlay = document.getElementById("modalOverlay");
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const modalFooter = document.getElementById("modalFooter");

    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = body;
    if (modalFooter) modalFooter.innerHTML = footer;

    if (modalOverlay) {
        modalOverlay.style.display = "flex";
        modalOverlay.classList.add("active");
    }
}

// Close modal
function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.style.display = "none";
        modalOverlay.classList.remove("active");
    }
}

// Show confirmation dialog
function showConfirm(msg, onOk) {
    openModal(
        "Confirm",
        `<p>${msg}</p>`,
        `
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" id="confirmOkBtn">Confirm</button>
        `
    );

    const okBtn = document.getElementById("confirmOkBtn");
    if (okBtn) {
        okBtn.onclick = () => {
            closeModal();
            if (onOk) onOk();
        };
    }
}

// Initialize modal event listeners
function initModal() {
    // Close modal when clicking overlay
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    // Close modal button
    const modalClose = document.getElementById("modalClose");
    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openModal,
        closeModal,
        showConfirm,
        initModal
    };
}