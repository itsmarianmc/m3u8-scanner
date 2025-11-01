const menu = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

const observerOptions = {
	root: null,
	rootMargin: '0px',
	threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting) {
			entry.target.classList.add('animated');
		}
	});
}, observerOptions);

menu.addEventListener('click', () => {
	const isActive = menu.classList.contains('active');

	if (isActive) {
		menu.classList.remove('active');
		navLinks.classList.remove('active');
	} else {
		menu.classList.add('active');
		navLinks.classList.add('active');
	}
});

window.addEventListener('scroll', function() {
	const header = document.querySelector('header');
	if (window.scrollY > 50) {
		header.classList.add('scrolled');
	} else {
		header.classList.remove('scrolled');
	}
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
	anchor.addEventListener('click', function(e) {
		e.preventDefault();

		const targetId = this.getAttribute('href');
		if (targetId === '#') return;

		const targetElement = document.querySelector(targetId);
		if (targetElement) {
			navLinks.classList.remove('active');
			menu.classList.remove('active');

			window.scrollTo({
				top: targetElement.offsetTop - 80,
				behavior: 'smooth'
			});
		}
	});
});

document.querySelectorAll('.feature-card, .step, .testimonial-card').forEach(el => {
	observer.observe(el);
});