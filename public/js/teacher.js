document.addEventListener('DOMContentLoaded', function() {
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const classControlSection = document.getElementById('classControlSection');
    const giveAccessBtn = document.getElementById('giveAccessBtn');
    const studentsGrid = document.getElementById('studentsGrid');
    const presentCountEl = document.getElementById('presentCount');
    const noStudentsMsg = document.getElementById('noStudentsMsg');
    
    let currentSelectedClass = null;
    let attendanceCheckInterval = null;
    let accessGranted = false;
    let teacherId = null;

    // Get teacherId from page
    teacherId = document.body.getAttribute('data-teacher-id');
    if (!teacherId) {
        const teacherDetails = document.querySelectorAll('.teacher-details span');
        if (teacherDetails.length > 0) {
            teacherId = teacherDetails[0].textContent.trim();
        }
    }
    
    console.log('Teacher ID:', teacherId);

    // Select class from timetable
    classItems.forEach((classItem) => {
        classItem.addEventListener('click', function() {
            const subject = this.getAttribute('data-subject');
            const time = this.getAttribute('data-time');
            const room = this.getAttribute('data-room');
            
            currentSelectedClass = { subject, time, room };
            
            document.getElementById('selectedClass').textContent = subject;
            document.getElementById('selectedTime').textContent = `${time} • ${room}`;
            document.getElementById('controlClassTitle').textContent = subject;
            
            welcomeSection.style.display = 'none';
            classControlSection.style.display = 'block';
            classControlSection.classList.add('active');
            
            classItems.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            
            // Check if access was already granted
            checkAccessStatus();
        });
    });

    // Give/Revoke Access Button
    if (giveAccessBtn) {
        giveAccessBtn.addEventListener('click', async function() {
            if (!currentSelectedClass) {
                showNotification('Please select a class first', 'error');
                return;
            }
            
            if (accessGranted) {
                // Revoke access
                if (confirm('Do you want to revoke access for this class?')) {
                    await revokeAccess();
                }
            } else {
                // Grant access
                await grantAccess();
            }
        });
    }

    async function grantAccess() {
        try {
            const response = await fetch('/teacher/grant-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSelectedClass.subject,
                    time: currentSelectedClass.time,
                    room: currentSelectedClass.room,
                    accessGranted: true,
                    teacherId: teacherId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                accessGranted = true;
                giveAccessBtn.innerHTML = '<i class="fas fa-lock-open"></i> REVOKE ACCESS';
                giveAccessBtn.style.background = '#ef4444';
                
                showNotification('✓ Access granted! Students can now mark attendance.', 'success');
                startAttendanceMonitoring();
            } else {
                showNotification('Failed to grant access: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error granting access:', error);
            showNotification('Error granting access', 'error');
        }
    }

    async function revokeAccess() {
        try {
            const response = await fetch('/teacher/grant-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSelectedClass.subject,
                    time: currentSelectedClass.time,
                    room: currentSelectedClass.room,
                    accessGranted: false,
                    teacherId: teacherId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                accessGranted = false;
                giveAccessBtn.innerHTML = '<i class="fas fa-lock"></i> Give Access to Students';
                giveAccessBtn.style.background = '#10b981';
                
                stopAttendanceMonitoring();
                showNotification('✓ Access revoked!', 'info');
            }
        } catch (error) {
            console.error('Error revoking access:', error);
        }
    }

    async function checkAccessStatus() {
        try {
            const response = await fetch(`/teacher/check-access-status?subject=${encodeURIComponent(currentSelectedClass.subject)}&time=${encodeURIComponent(currentSelectedClass.time)}&room=${encodeURIComponent(currentSelectedClass.room)}`);
            
            const data = await response.json();
            
            if (data.success && data.accessGranted) {
                accessGranted = true;
                giveAccessBtn.innerHTML = '<i class="fas fa-lock-open"></i> REVOKE ACCESS';
                giveAccessBtn.style.background = '#ef4444';
                startAttendanceMonitoring();
            } else {
                accessGranted = false;
                giveAccessBtn.innerHTML = '<i class="fas fa-lock"></i> Give Access to Students';
                giveAccessBtn.style.background = '#10b981';
                stopAttendanceMonitoring();
            }
        } catch (error) {
            console.error('Error checking access:', error);
        }
    }

    function startAttendanceMonitoring() {
        if (attendanceCheckInterval) {
            clearInterval(attendanceCheckInterval);
        }
        
        loadAttendance();
        attendanceCheckInterval = setInterval(loadAttendance, 2000);  // Check every 2 seconds
    }

    function stopAttendanceMonitoring() {
        if (attendanceCheckInterval) {
            clearInterval(attendanceCheckInterval);
            attendanceCheckInterval = null;
        }
        
        // Reset display
        if (studentsGrid) {
            studentsGrid.innerHTML = `
                <div class="no-students" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #888;">
                    <i class="fas fa-user-clock" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p style="font-size: 1.2rem;">Give access to students to start attendance tracking</p>
                </div>
            `;
        }
        if (presentCountEl) {
            presentCountEl.textContent = '0';
        }
    }

    async function loadAttendance() {
        try {
            const response = await fetch(`/teacher/get-attendance?subject=${encodeURIComponent(currentSelectedClass.subject)}&time=${encodeURIComponent(currentSelectedClass.time)}&room=${encodeURIComponent(currentSelectedClass.room)}`);
            
            const data = await response.json();
            
            if (data.success) {
                displayAttendance(data.attendance);
                if (presentCountEl) {
                    presentCountEl.textContent = data.attendance.length;
                }
            }
        } catch (error) {
            console.error('Error loading attendance:', error);
        }
    }

    function displayAttendance(attendance) {
        if (!studentsGrid) return;
        
        if (attendance.length === 0) {
            studentsGrid.innerHTML = `
                <div class="no-students" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #888;">
                    <i class="fas fa-user-clock" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p style="font-size: 1.2rem;">Waiting for students to mark attendance...</p>
                </div>
            `;
            return;
        }
        
        studentsGrid.innerHTML = attendance.map(student => `
            <div class="student-card" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 20px; border-radius: 12px; border: 2px solid #10b981; animation: slideIn 0.3s ease; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="fas fa-user-check" style="color: white; font-size: 1.5rem;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 1.1rem; font-weight: 600; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${student.studentName}</div>
                        <div style="font-size: 0.9rem; color: #94a3b8;">Roll No: ${student.rollNumber}</div>
                    </div>
                    <div style="color: #10b981; font-size: 1.8rem;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #334155; font-size: 0.85rem; color: #94a3b8;">
                    <span><i class="fas fa-clock" style="margin-right: 5px; color: #60a5fa;"></i>${new Date(student.timestamp).toLocaleTimeString()}</span>
                    <span style="color: #10b981; font-weight: 600;"><i class="fas fa-brain" style="margin-right: 5px;"></i>${(student.confidence * 100).toFixed(1)}%</span>
                </div>
            </div>
        `).join('');
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideInRight 0.3s ease;
        `;
        
        if (type === 'success') {
            notification.style.backgroundColor = '#10b981';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#ef4444';
        } else {
            notification.style.backgroundColor = '#3b82f6';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

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
    
    window.addEventListener('beforeunload', stopAttendanceMonitoring);
});