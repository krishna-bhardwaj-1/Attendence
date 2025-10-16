document.addEventListener('DOMContentLoaded', function() {
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const classControlSection = document.getElementById('classControlSection');
    
    let currentSelectedClass = null;
    let accessGranted = false;
    let teacherId = null; // Add this to store teacherId

    // Get teacherId from the page
    // Method 1: From data attribute
    teacherId = document.body.getAttribute('data-teacher-id');
    
    // Method 2: If not found, extract from teacher details
    if (!teacherId) {
        const teacherDetails = document.querySelectorAll('.teacher-details span');
        if (teacherDetails.length > 0) {
            // First span contains the teacherId with icon
            const firstSpan = teacherDetails[0].textContent.trim();
            teacherId = firstSpan;
        }
    }
    
    console.log('Teacher ID:', teacherId);

    classItems.forEach((classItem) => {
        classItem.addEventListener('click', function() {
            selectClass(this);
        });
    });

    function selectClass(clickedItem) {
        const subject = clickedItem.getAttribute('data-subject');
        const time = clickedItem.getAttribute('data-time');
        const room = clickedItem.getAttribute('data-room');
        
        currentSelectedClass = { subject, time, room };
        accessGranted = false; 
        
        classItems.forEach(item => {
            item.classList.remove('active');
        });
        clickedItem.classList.add('active');
        
        // Hide welcome, show class control
        welcomeSection.style.display = 'none';
        classControlSection.classList.add('active');
        
        document.getElementById('selectedClass').textContent = subject;
        document.getElementById('selectedTime').textContent = `${time} • ${room}`;
        document.getElementById('controlClassTitle').textContent = subject;
        
        // Reset button state when selecting a new class
        resetAccessButton();
        
        // Clear students grid when selecting new class
        const studentsGrid = document.getElementById('studentsGrid');
        if (studentsGrid) {
            studentsGrid.innerHTML = '<div class="no-students" id="noStudentsMsg"><i class="fas fa-user-clock"></i><p>Give access to students to start attendance tracking</p></div>';
        }
    }
    
    function resetAccessButton() {
        const accessBtn = document.getElementById('giveAccessBtn');
        if (accessBtn) {
            accessBtn.textContent = '🔓 GIVE ACCESS TO STUDENTS';
            accessBtn.classList.remove('access-revoked');
            accessBtn.classList.add('access-granted');
            accessBtn.style.backgroundColor = '#10b981';
        }
    }
    
    // Give Access Button Handler
    const giveAccessBtn = document.getElementById('giveAccessBtn');
    if (giveAccessBtn) {
        giveAccessBtn.addEventListener('click', async function() {
            if (!currentSelectedClass || !teacherId) {
                showNotification('Missing class or teacher information', 'error');
                return;
            }
            
            accessGranted = !accessGranted;
            
            if (accessGranted) {
                // Access granted state
                this.textContent = '🔒 REVOKE ACCESS';
                this.classList.remove('access-granted');
                this.classList.add('access-revoked');
                this.style.backgroundColor = '#ef4444';
                
                // Send access grant to server
                try {
                    const response = await fetch('/api/teacher/grant-access', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            subject: currentSelectedClass.subject,
                            time: currentSelectedClass.time,
                            room: currentSelectedClass.room,
                            accessGranted: true,
                            teacherId: teacherId
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        console.log('Access granted successfully');
                        showNotification('Access granted to students!', 'success');
                    } else {
                        throw new Error(data.message || 'Failed to grant access');
                    }
                } catch (error) {
                    console.error('Error granting access:', error);
                    showNotification('Error: ' + error.message, 'error');
                    accessGranted = false;
                    resetAccessButton();
                }
            } else {
                // Access revoked state
                this.textContent = '🔓 GIVE ACCESS TO STUDENTS';
                this.classList.remove('access-revoked');
                this.classList.add('access-granted');
                this.style.backgroundColor = '#10b981';
                
                // Revoke access on server
                try {
                    const response = await fetch('/api/teacher/grant-access', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            subject: currentSelectedClass.subject,
                            time: currentSelectedClass.time,
                            room: currentSelectedClass.room,
                            accessGranted: false,
                            teacherId: teacherId
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        console.log('Access revoked successfully');
                        showNotification('Access revoked from students', 'info');
                    } else {
                        throw new Error(data.message || 'Failed to revoke access');
                    }
                } catch (error) {
                    console.error('Error revoking access:', error);
                    showNotification('Error: ' + error.message, 'error');
                }
            }
        });
    }
    
    // Helper function to show notifications
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-in;
        `;
        
        if (type === 'success') {
            notification.style.backgroundColor = '#10b981';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#ef4444';
        } else {
            notification.style.backgroundColor = '#3b82f6';
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    function updateDateTime() {
        const now = new Date();
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', dateOptions);
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