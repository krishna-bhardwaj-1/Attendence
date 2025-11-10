document.addEventListener('DOMContentLoaded', function() {
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const classControlSection = document.getElementById('classControlSection');
    const giveAccessBtn = document.getElementById('giveAccessBtn');
    const studentsGrid = document.getElementById('studentsGrid');
    const presentCountEl = document.getElementById('presentCount');
    const totalStudentsEl = document.getElementById('totalStudents');
    
    let currentSelectedClass = null;
    let attendanceCheckInterval = null;
    let accessGranted = false;
    let teacherId = null;
    let lastAttendanceCount = 0;

    // Get teacherId from page
    teacherId = document.body.getAttribute('data-teacher-id');
    if (!teacherId) {
        const teacherDetails = document.querySelectorAll('.teacher-details span');
        if (teacherDetails.length > 0) {
            teacherId = teacherDetails[0].textContent.trim();
        }
    }
    

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
            // Load attendance and total count when class is selected
            loadAttendance();
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
                if (confirm('Do you want to revoke access for this class?')) {
                    await revokeAccess();
                }
            } else {
                await grantAccess();
            }
        });
    }

    async function grantAccess() {
        try {
            showNotification('Granting access...', 'info');
            
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
            showNotification('Error revoking access', 'error');
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
            // Silent error handling
        }
    }

    function startAttendanceMonitoring() {
        if (attendanceCheckInterval) {
            clearInterval(attendanceCheckInterval);
        }
        loadAttendance();
        attendanceCheckInterval = setInterval(loadAttendance, 5000);
    }

    function stopAttendanceMonitoring() {
        if (attendanceCheckInterval) {
            clearInterval(attendanceCheckInterval);
            attendanceCheckInterval = null;
        }
        lastAttendanceCount = 0;
        
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
        if (!currentSelectedClass) return;
        
        try {
            const response = await fetch(`/teacher/get-attendance-records?subject=${encodeURIComponent(currentSelectedClass.subject)}&time=${encodeURIComponent(currentSelectedClass.time)}&room=${encodeURIComponent(currentSelectedClass.room)}`);
            
            const data = await response.json();
            
            if (data.success) {
                // Update total students count dynamically
                if (totalStudentsEl && data.totalStudents !== undefined) {
                    totalStudentsEl.textContent = data.totalStudents;
                }
                
                if (data.count !== lastAttendanceCount) {
                    if (data.count > lastAttendanceCount) {
                        const newStudents = data.count - lastAttendanceCount;
                        showNotification(`🎓 ${newStudents} new student(s) marked present!`, 'success');
                    }
                    lastAttendanceCount = data.count;
                    displayAttendance(data.attendance);
                    if (presentCountEl) {
                        presentCountEl.textContent = data.count;
                    }
                } else {
                    if (totalStudentsEl && data.totalStudents !== undefined) {
                        totalStudentsEl.textContent = data.totalStudents;
                    }
                }
            }
        } catch (error) {
            // Silent error handling
        }
    }

    function displayAttendance(attendance) {
        if (!studentsGrid) return;
        
        if (attendance.length === 0) {
            studentsGrid.innerHTML = `
                <div class="no-students" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #888;">
                    <i class="fas fa-user-clock" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p style="font-size: 1.2rem;">Waiting for students to mark attendance...</p>
                    <p style="font-size: 0.9rem; margin-top: 10px; color: #666;">Students will appear here in real-time as they mark their attendance</p>
                </div>
            `;
            return;
        }
        
        studentsGrid.innerHTML = attendance.map((student, index) => `
            <div class="student-card" style="
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
                padding: 20px; 
                border-radius: 12px; 
                border: 2px solid #10b981; 
                animation: slideInUp 0.5s ease ${index * 0.1}s both;
                margin-bottom: 10px;
                box-shadow: 0 4px 6px rgba(16, 185, 129, 0.1);
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 10px 20px rgba(16, 185, 129, 0.2)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(16, 185, 129, 0.1)';">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
                    <div style="
                        width: 55px; 
                        height: 55px; 
                        background: linear-gradient(135deg, #10b981, #059669); 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        flex-shrink: 0;
                        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
                    ">
                        <i class="fas fa-user-check" style="color: white; font-size: 1.6rem;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="
                            font-size: 1.15rem; 
                            font-weight: 700; 
                            color: #fff; 
                            margin-bottom: 5px; 
                            white-space: nowrap; 
                            overflow: hidden; 
                            text-overflow: ellipsis;
                        ">${student.studentName}</div>
                        <div style="font-size: 0.9rem; color: #94a3b8; font-weight: 500;">
                            <i class="fas fa-id-badge" style="margin-right: 5px;"></i>Roll No: ${student.rollNumber}
                        </div>
                    </div>
                    <div style="color: #10b981; font-size: 2rem; animation: bounceIn 0.5s ease;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                </div>
                <div style="
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding-top: 12px; 
                    border-top: 1px solid #334155; 
                    font-size: 0.85rem; 
                    color: #94a3b8;
                ">
                    <span style="display: flex; align-items: center;">
                        <i class="fas fa-clock" style="margin-right: 6px; color: #60a5fa;"></i>
                        ${new Date(student.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                        })}
                    </span>
                    <span style="
                        color: #10b981; 
                        font-weight: 700;
                        background: rgba(16, 185, 129, 0.1);
                        padding: 4px 10px;
                        border-radius: 6px;
                    ">
                        <i class="fas fa-brain" style="margin-right: 5px;"></i>${(student.confidence * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
        `).join('');
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            font-size: 0.95rem;
            z-index: 10000;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease;
            max-width: 350px;
        `;
        
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
        }
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" style="font-size: 1.2rem;"></i>
                <span>${message}</span>
            </div>
        `;
        
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