document.addEventListener('DOMContentLoaded', function() {
    const classItems = document.querySelectorAll('.class-item');
    const welcomeSection = document.getElementById('welcomeSection');
    const classControlSection = document.getElementById('classControlSection');

    classItems.forEach((classItem) => {
        classItem.addEventListener('click', function() {
            selectClass(this);
        });
    });

    function selectClass(clickedItem) {
        const subject = clickedItem.getAttribute('data-subject');
        const time = clickedItem.getAttribute('data-time');
        const room = clickedItem.getAttribute('data-room');
        classItems.forEach(item => {
            item.classList.remove('active');
        });
        clickedItem.classList.add('active');
        welcomeSection.style.display = 'none';
        classControlSection.style.display = 'block';
        document.getElementById('selectedClass').textContent = subject;
        document.getElementById('selectedTime').textContent = `${time} • ${room}`;
        document.getElementById('controlClassTitle').textContent = subject;
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