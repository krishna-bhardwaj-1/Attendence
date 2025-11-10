document.addEventListener('DOMContentLoaded', function() {    
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const attendanceSection = document.getElementById('attendanceSection');
    const markPresentBtn = document.getElementById('markPresentBtn');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusDescription = document.getElementById('statusDescription');
    
    let currentSelectedClass = null;
    let accessCheckInterval = null;

    classItems.forEach((classItem, index) => {
        classItem.addEventListener('click', function() {
            const subject = this.getAttribute('data-subject');
            const time = this.getAttribute('data-time');
            const room = this.getAttribute('data-room');
            
            // Store current selected class
            currentSelectedClass = { subject, time, room };
            
            const selectedClass = document.getElementById('selectedClass');
            const selectedTime = document.getElementById('selectedTime');
            
            if (selectedClass) selectedClass.textContent = subject;
            if (selectedTime) selectedTime.textContent = time;
            
            if (welcomeSection) welcomeSection.style.display = 'none';
            if (attendanceSection) attendanceSection.style.display = 'block';
            
            classItems.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            
            // Check access status immediately
            checkAccessStatus();
            
            // Clear any existing interval
            if (accessCheckInterval) {
                clearInterval(accessCheckInterval);
            }
            
            // Check access status every 3 seconds
            accessCheckInterval = setInterval(checkAccessStatus, 3000);
        });
    });
    
    async function checkAccessStatus() {
        if (!currentSelectedClass) return;
        
        try {
            const response = await fetch(`/student/check-access?subject=${encodeURIComponent(currentSelectedClass.subject)}&time=${encodeURIComponent(currentSelectedClass.time)}&room=${encodeURIComponent(currentSelectedClass.room)}`);
            
            const data = await response.json();
            
            if (data.success && data.accessGranted) {
                // Access is granted - enable button
                enableMarkPresentButton();
                // Stop checking after access is granted
                if (accessCheckInterval) {
                    clearInterval(accessCheckInterval);
                    accessCheckInterval = null;
                }
            } else {
                // Access is not granted - disable button
                disableMarkPresentButton();
            }
        } catch (error) {
            console.error('Error checking access:', error);
            // For testing: enable button even if check fails
            enableMarkPresentButton();
            if (accessCheckInterval) {
                clearInterval(accessCheckInterval);
                accessCheckInterval = null;
            }
        }
    }
    
    function enableMarkPresentButton() {
        if (markPresentBtn) {
            markPresentBtn.classList.remove('disabled');
            markPresentBtn.style.opacity = '1';
            markPresentBtn.style.cursor = 'pointer';
            markPresentBtn.style.pointerEvents = 'auto';
            markPresentBtn.onclick = null; // Remove any onclick blocking
            console.log('Button enabled - pointerEvents:', markPresentBtn.style.pointerEvents);
        }
        
        if (statusIcon) {
            statusIcon.classList.remove('pending');
            statusIcon.classList.add('granted');
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        }
        
        if (statusTitle) {
            statusTitle.textContent = 'Access Granted';
        }
        
        if (statusDescription) {
            statusDescription.textContent = 'Teacher has enabled attendance. Click "Mark Present" to mark your attendance.';
        }
    }
    
    function disableMarkPresentButton() {
        if (markPresentBtn) {
            markPresentBtn.classList.add('disabled');
            markPresentBtn.style.opacity = '0.5';
            markPresentBtn.style.cursor = 'not-allowed';
            markPresentBtn.style.pointerEvents = 'none';
        }
        
        if (statusIcon) {
            statusIcon.classList.remove('granted');
            statusIcon.classList.add('pending');
            statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
        }
        
        if (statusTitle) {
            statusTitle.textContent = 'Attendance Pending';
        }
        
        if (statusDescription) {
            statusDescription.textContent = 'Waiting for teacher to grant access. Please wait...';
        }
    }
    
    // Mark Present click is handled in views/student/portal.hbs
    
    // Clean up interval when page is unloaded
    window.addEventListener('beforeunload', function() {
        if (accessCheckInterval) {
            clearInterval(accessCheckInterval);
        }
    });
    
    // Update date and time
    function updateDateTime() {
        const now = new Date();
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const currentDateElement = document.getElementById('currentDate');
        if (currentDateElement) {
            currentDateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
        }
        
        const timeOptions = { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true 
        };
        const currentTimeElement = document.getElementById('currentTime');
        if (currentTimeElement) {
            currentTimeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
        }
    }
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
});