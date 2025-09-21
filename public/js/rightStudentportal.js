document.addEventListener('DOMContentLoaded', function() {    
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const attendanceSection = document.getElementById('attendanceSection');
    classItems.forEach((classItem, index) => {
        classItem.addEventListener('click', function() {
            
            const subject = this.getAttribute('data-subject');
            const time = this.getAttribute('data-time');
            const selectedClass = document.getElementById('selectedClass');
            const selectedTime = document.getElementById('selectedTime');
            
            if (selectedClass) selectedClass.textContent = subject;
            if (selectedTime) selectedTime.textContent = time;
            
            if (welcomeSection) welcomeSection.style.display = 'none';
            if (attendanceSection) attendanceSection.style.display = 'block';
            
            classItems.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
        });
    });
});