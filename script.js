/* ================================================================
   script.js — Portfolio Frontend
   Connects to Node.js backend for the contact form
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. CUSTOM CURSOR ─────────────────────────────────────────
  const cursor     = document.getElementById('cursor');
  const cursorRing = document.getElementById('cursorRing');

  // Certificate direct open handler
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('section#certifications a[href$=".pdf"], section#certifications a[href$=".jpg"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = link.href;
        window.open(url, '_blank');
      });
    });
  });

  document.addEventListener('mousemove', e => {
    cursor.style.left     = e.clientX + 'px';
    cursor.style.top      = e.clientY + 'px';
    cursorRing.style.left = e.clientX + 'px';
    cursorRing.style.top  = e.clientY + 'px';
  });

  document.querySelectorAll('a,button,.skill-card,.cert-card,.project-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(2.2)';
      cursorRing.style.opacity = '0.2';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(1)';
      cursorRing.style.opacity = '0.5';
    });
  });


  // ── 2. SCROLL REVEAL ─────────────────────────────────────────
  const revealEls = document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.tl-item');

  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 70);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.10 });

  revealEls.forEach(el => revealObs.observe(el));


  // ── 3. SKILL BARS ─────────────────────────────────────────────
  const barObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.dataset.width;
        barObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.bar-fill').forEach(b => barObs.observe(b));


  // ── 4. NAV — SCROLL SHADOW + ACTIVE LINK ─────────────────────
  const navbar   = document.getElementById('navbar');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);

    let cur = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 200) cur = s.id;
    });
    navLinks.forEach(l => {
      l.style.color = l.getAttribute('href') === '#' + cur ? 'var(--accent)' : '';
    });
  });


// ── 5. CONTACT FORM → POST to /api/contact (local) or Formspree (GitHub Pages) ───────────────────
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    // Check if using Formspree (has action URL)
    const isFormspree = contactForm.action && contactForm.action.includes('formspree.io');
    
    if (isFormspree) {
      // Formspree mode - form submits naturally
      contactForm.addEventListener('submit', async (e) => {
        const btn = document.getElementById('cf-btn');
        btn.textContent = 'Sending…';
        btn.disabled = true;
        // Formspree will handle the submission
        // Just show sending state, page will redirect on success
      });
    } else {
      // Backend API mode (for local development)
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn      = document.getElementById('cf-btn');
        const statusEl = document.getElementById('cf-status');
        const name     = document.getElementById('cf-name').value.trim();
        const email    = document.getElementById('cf-email').value.trim();
        const message  = document.getElementById('cf-message').value.trim();

        // Hide previous status
        statusEl.style.display = 'none';
        statusEl.className = 'cf-status';

        // Disable button while submitting
        btn.disabled    = true;
        btn.textContent = 'Sending…';

        try {
          const res  = await fetch('/api/contact', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, email, message })
          });
          const data = await res.json();

          if (res.ok && data.success) {
            // ✅ Success
            statusEl.textContent  = data.message;
            statusEl.classList.add('success');
            statusEl.style.display = 'block';
            contactForm.reset();
            btn.textContent = 'Message Sent ✅';
            setTimeout(() => {
              btn.disabled    = false;
              btn.textContent = 'Send Message ✉️';
            }, 4000);
          } else {
            // ❌ Server returned error
            statusEl.textContent   = data.error || 'Something went wrong. Please try again.';
            statusEl.classList.add('error');
            statusEl.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Send Message ✉️';
          }
        } catch (err) {
          // ❌ Network / server offline
          statusEl.textContent   = 'Cannot reach the server. Make sure the backend is running.';
          statusEl.classList.add('error');
          statusEl.style.display = 'block';
          btn.disabled    = false;
          btn.textContent = 'Send Message ✉️';
        }
      });
    }
  }

}); // end DOMContentLoaded
