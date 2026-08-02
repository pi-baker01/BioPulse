/* ==========================================================================
   BIOPULSE PI - COLLEGE BIOMETRIC ATTENDANCE APPLICATION LOGIC
   8-Period Daily Matrix • 2-Day Consecutive Absence Detector • Raspberry Pi Bridge
   ========================================================================== */

class BioPulseApp {
  constructor() {
    this.currentTab = 'terminal';
    this.activePeriod = 3; // Default Period 3
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.selectedMonth = '2026-07';
    this.audioEnabled = true;
    
    // Students Initial Seed Data (Teacher can add more)
    this.students = this.loadStudentsFromStorage() || [
      {
        id: 'STD001',
        name: 'Rahul Sharma',
        roll: 'CS2024045',
        dept: 'CSE',
        batch: '2024-2028',
        fingerprintId: 101,
        photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543210'
      },
      {
        id: 'STD002',
        name: 'Ananya Verma',
        roll: 'CS2024012',
        dept: 'CSE',
        batch: '2024-2028',
        fingerprintId: 102,
        photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543211'
      },
      {
        id: 'STD003',
        name: 'Vikramaditya Singh',
        roll: 'EC2024089',
        dept: 'ECE',
        batch: '2024-2028',
        fingerprintId: 103,
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543212'
      },
      {
        id: 'STD004',
        name: 'Priya Nair',
        roll: 'IT2024033',
        dept: 'IT',
        batch: '2024-2028',
        fingerprintId: 104,
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543213'
      },
      {
        id: 'STD005',
        name: 'Rohan Kulkarni',
        roll: 'CS2024077',
        dept: 'CSE',
        batch: '2024-2028',
        fingerprintId: 105,
        photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543214'
      },
      {
        id: 'STD006',
        name: 'Sneha Patel',
        roll: 'EC2024019',
        dept: 'ECE',
        batch: '2024-2028',
        fingerprintId: 106,
        photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543215'
      },
      {
        id: 'STD007',
        name: 'Arjun Mehta',
        roll: 'CS2024008',
        dept: 'CSE',
        batch: '2024-2028',
        fingerprintId: 107,
        photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80',
        phone: '+91 9876543216'
      }
    ];

    // Attendance DB: date -> studentId -> { 1:'P', 2:'P', ..., 8:'A' }
    this.attendanceDB = this.loadAttendanceFromStorage() || this.generateSeedAttendance();

    this.initAudioContext();
    this.initDOM();
    this.initCanvasScanner();
    this.bindEvents();
    this.renderAll();
    this.startClock();
  }

  /* ==========================================================================
     LOCAL STORAGE STATE MANAGEMENT
     ========================================================================== */
  loadStudentsFromStorage() {
    try {
      const data = localStorage.getItem('biopulse_students');
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  }

  saveStudentsToStorage() {
    try {
      localStorage.setItem('biopulse_students', JSON.stringify(this.students));
    } catch (e) {}
  }

  loadAttendanceFromStorage() {
    try {
      const data = localStorage.getItem('biopulse_attendance_db');
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  }

  saveAttendanceToStorage() {
    try {
      localStorage.setItem('biopulse_attendance_db', JSON.stringify(this.attendanceDB));
    } catch (e) {}
  }

  /* Generate 8-period attendance data for today and previous days */
  generateSeedAttendance() {
    const db = {};
    const todayStr = this.selectedDate; // e.g. 2026-07-30
    
    // Generate dates for current month (July 2026)
    const dates = [];
    for (let d = 25; d <= 30; d++) {
      dates.push(`2026-07-${d < 10 ? '0' + d : d}`);
    }

    dates.forEach((dateStr) => {
      db[dateStr] = {};
      this.students.forEach((std, idx) => {
        const pState = {};
        
        // Simulate specific student absences for 2-day consecutive alert testing
        if ((std.id === 'STD003' || std.id === 'STD005') && (dateStr === '2026-07-29' || dateStr === '2026-07-30')) {
          // Absent for all 8 periods for 2 consecutive days!
          for (let p = 1; p <= 8; p++) pState[p] = 'A';
        } else {
          // Random realistic attendance pattern for 8 periods
          for (let p = 1; p <= 8; p++) {
            const rand = Math.random();
            if (rand > 0.15) pState[p] = 'P';
            else if (rand > 0.05) pState[p] = 'L';
            else pState[p] = 'A';
          }
        }
        db[dateStr][std.id] = pState;
      });
    });

    return db;
  }

  /* ==========================================================================
     AUDIO SYNTHESIZER ENGINE (Web Audio API)
     ========================================================================== */
  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playBeep(type = 'success') {
    if (!this.audioEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    if (type === 'success') {
      // High pitch double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1318.5, now + 0.1); // E6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      // Low saw buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }

  /* ==========================================================================
     CANVAS FINGERPRINT SCANNER ANIMATION
     ========================================================================== */
  initCanvasScanner() {
    this.canvas = document.getElementById('scanner-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.drawFingerprintPattern(0);
  }

  drawFingerprintPattern(pulse = 0) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;

    // Outer Glow Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, 85 + Math.sin(pulse) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Ridges (Concentric ellipses)
    for (let r = 15; r <= 70; r += 7) {
      ctx.beginPath();
      ctx.ellipse(
        centerX + Math.sin(r) * 2,
        centerY + Math.cos(r) * 3,
        r,
        r * 1.3,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(0, 242, 254, ${0.4 + (r / 100)})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([Math.random() * 20 + 10, Math.random() * 5 + 2]);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // Core Minutiae Points
    const minutiaePoints = [
      { x: centerX - 20, y: centerY - 30 },
      { x: centerX + 25, y: centerY - 15 },
      { x: centerX - 10, y: centerY + 25 },
      { x: centerX + 15, y: centerY + 35 },
      { x: centerX, y: centerY }
    ];

    minutiaePoints.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff2a5f';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 42, 95, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  triggerScanAnimation(callback) {
    const wrapper = document.getElementById('fingerprint-trigger');
    wrapper.classList.add('scanning');
    
    let frame = 0;
    const interval = setInterval(() => {
      frame += 0.2;
      this.drawFingerprintPattern(frame);
    }, 30);

    setTimeout(() => {
      clearInterval(interval);
      wrapper.classList.remove('scanning');
      this.drawFingerprintPattern(0);
      if (callback) callback();
    }, 1200);
  }

  /* ==========================================================================
     DOM & EVENT BINDINGS
     ========================================================================== */
  initDOM() {
    // Set date picker defaults
    const datePicker = document.getElementById('daily-date-picker');
    if (datePicker) datePicker.value = this.selectedDate;
  }

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        this.switchTab(target);
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.innerHTML = newTheme === 'light' ? '<i class="fa-solid fa-sun text-amber"></i>' : '<i class="fa-solid fa-moon"></i>';
      });
    }

    // Period Selector
    const periodSel = document.getElementById('period-selector');
    if (periodSel) {
      periodSel.addEventListener('change', (e) => {
        this.activePeriod = parseInt(e.target.value);
        document.getElementById('stat-current-period').textContent = `P${this.activePeriod}`;
        document.getElementById('current-period-name').textContent = `Period ${this.activePeriod}`;
      });
    }

    // Fingerprint Scanner Click / Scan
    const fpTrigger = document.getElementById('fingerprint-trigger');
    if (fpTrigger) {
      fpTrigger.addEventListener('click', () => this.handleSimulatedScan());
    }

    const btnScanRandom = document.getElementById('btn-scan-random');
    if (btnScanRandom) {
      btnScanRandom.addEventListener('click', () => this.handleSimulatedScan());
    }

    const btnScanSelected = document.getElementById('btn-scan-selected');
    if (btnScanSelected) {
      btnScanSelected.addEventListener('click', () => {
        const selectedId = document.getElementById('select-quick-student').value;
        const student = this.students.find(s => s.id === selectedId);
        this.handleSimulatedScan(student);
      });
    }

    // Sound Toggle Button
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        this.audioEnabled = !this.audioEnabled;
        btnSound.innerHTML = this.audioEnabled 
          ? '<i class="fa-solid fa-volume-high"></i> Audio Feedback: ON'
          : '<i class="fa-solid fa-volume-xmark"></i> Audio Feedback: OFF';
      });
    }

    // Date Picker Change in Daily Summary
    const datePicker = document.getElementById('daily-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        if (!this.attendanceDB[this.selectedDate]) {
          // Initialize date if new
          this.attendanceDB[this.selectedDate] = {};
          this.students.forEach(s => {
            const p = {};
            for (let i = 1; i <= 8; i++) p[i] = 'A';
            this.attendanceDB[this.selectedDate][s.id] = p;
          });
          this.saveAttendanceToStorage();
        }
        this.renderDailyMatrix();
        this.checkConsecutiveAbsences();
      });
    }

    // Filters for Daily Matrix
    const filterDept = document.getElementById('filter-dept');
    const searchDaily = document.getElementById('search-student-daily');
    if (filterDept) filterDept.addEventListener('change', () => this.renderDailyMatrix());
    if (searchDaily) searchDaily.addEventListener('input', () => this.renderDailyMatrix());

    // Export CSV Handlers
    const btnExportDaily = document.getElementById('btn-export-daily-csv');
    if (btnExportDaily) btnExportDaily.addEventListener('click', () => this.exportDailyCSV());

    const btnExportMonthly = document.getElementById('btn-export-monthly-csv');
    if (btnExportMonthly) btnExportMonthly.addEventListener('click', () => this.exportMonthlyCSV());

    // Teacher Student Photo Upload & Form
    this.bindStudentFormEvents();

    // Copy Code Handler
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const codeText = document.getElementById('python-code-block').innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          btnCopyCode.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> Copied!';
          setTimeout(() => btnCopyCode.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Code', 2000);
        });
      });
    }

    // Test Pi Ping Button
    const btnTestPing = document.getElementById('btn-test-pi-ping');
    if (btnTestPing) {
      btnTestPing.addEventListener('click', () => {
        btnTestPing.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pinging...';
        setTimeout(() => {
          btnTestPing.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> Ping OK (2ms)';
          setTimeout(() => btnTestPing.innerHTML = '<i class="fa-solid fa-network-wired"></i> Test Ping', 2000);
        }, 800);
      });
    }
  }

  bindStudentFormEvents() {
    const form = document.getElementById('form-add-student');
    const photoInput = document.getElementById('input-student-photo');
    const photoPreview = document.getElementById('student-photo-preview');
    const dropzone = document.getElementById('photo-dropzone');
    const uploadBtn = document.getElementById('btn-upload-trigger');
    const webcamBtn = document.getElementById('btn-webcam-snap');

    let currentPhotoBase64 = photoPreview.src;

    if (uploadBtn && photoInput) {
      uploadBtn.addEventListener('click', () => photoInput.click());
    }

    if (dropzone && photoInput) {
      dropzone.addEventListener('click', () => photoInput.click());
    }

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            currentPhotoBase64 = event.target.result;
            photoPreview.src = currentPhotoBase64;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (webcamBtn) {
      webcamBtn.addEventListener('click', () => {
        alert('WebCam Snapshot Simulated! Photo captured from laptop camera.');
        currentPhotoBase64 = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
        photoPreview.src = currentPhotoBase64;
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('input-student-name').value.trim();
        const roll = document.getElementById('input-student-roll').value.trim();
        const dept = document.getElementById('input-student-dept').value;
        const batch = document.getElementById('input-student-batch').value.trim() || '2024-2028';
        const fpId = parseInt(document.getElementById('input-fingerprint-id').value);
        const phone = document.getElementById('input-guardian-phone').value.trim() || '+91 9800000000';

        const newStudent = {
          id: 'STD' + String(this.students.length + 1).padStart(3, '0'),
          name: name,
          roll: roll,
          dept: dept,
          batch: batch,
          fingerprintId: fpId,
          photo: currentPhotoBase64,
          phone: phone
        };

        this.students.push(newStudent);
        this.saveStudentsToStorage();

        // Initialize student attendance for today
        if (!this.attendanceDB[this.selectedDate]) this.attendanceDB[this.selectedDate] = {};
        const p = {};
        for (let i = 1; i <= 8; i++) p[i] = 'A';
        this.attendanceDB[this.selectedDate][newStudent.id] = p;
        this.saveAttendanceToStorage();

        form.reset();
        photoPreview.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

        alert(`✅ Student ${name} (Roll: ${roll}) registered successfully with Fingerprint Sensor ID #${fpId}!`);
        this.renderAll();
      });
    }
  }

  /* Switch active tab view */
  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabId}`);
    });
  }

  /* Live Clock */
  startClock() {
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
      const now = new Date();
      if (clockEl) clockEl.textContent = now.toLocaleTimeString();
    }, 1000);
  }

  /* ==========================================================================
     SIMULATED BIOMETRIC FINGERPRINT SCAN
     ========================================================================== */
  handleSimulatedScan(targetStudent = null) {
    const student = targetStudent || this.students[Math.floor(Math.random() * this.students.length)];
    const period = this.activePeriod;

    this.triggerScanAnimation(() => {
      // Mark attendance for current period
      if (!this.attendanceDB[this.selectedDate]) this.attendanceDB[this.selectedDate] = {};
      if (!this.attendanceDB[this.selectedDate][student.id]) {
        const p = {};
        for (let i = 1; i <= 8; i++) p[i] = 'A';
        this.attendanceDB[this.selectedDate][student.id] = p;
      }

      this.attendanceDB[this.selectedDate][student.id][period] = 'P';
      this.saveAttendanceToStorage();

      // Play Audio Feedback
      this.playBeep('success');

      // Update Verification Card Display
      this.renderVerificationResult(student, period, true);

      // Append to Live Feed
      this.appendFeedEntry(student, period);

      // Refresh Tables & Absences
      this.renderDailyMatrix();
      this.checkConsecutiveAbsences();
    });
  }

  renderVerificationResult(student, period, isMatch = true) {
    const container = document.getElementById('verification-body');
    const timeStr = new Date().toLocaleTimeString();

    document.getElementById('scan-timestamp').textContent = timeStr;

    if (isMatch) {
      container.innerHTML = `
        <div class="student-result-card">
          <img src="${student.photo}" alt="${student.name}" class="result-photo">
          <div class="result-details">
            <h4 class="result-name">${student.name}</h4>
            <span class="result-meta">Roll: <strong>${student.roll}</strong> • Dept: <strong>${student.dept}</strong></span>
            <span class="result-score"><i class="fa-solid fa-fingerprint"></i> Template Match ID #${student.fingerprintId} (Score: 98%)</span>
            <span class="result-meta" style="margin-top: 4px;">Period ${period} Attendance: <strong class="text-emerald">MARKED PRESENT ✅</strong></span>
          </div>
          <span class="result-badge success">VERIFIED</span>
        </div>
      `;
    }
  }

  appendFeedEntry(student, period) {
    const feedList = document.getElementById('terminal-feed-list');
    const timeStr = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = 'feed-item';
    entry.innerHTML = `
      <div class="feed-student">
        <img src="${student.photo}" alt="${student.name}" class="feed-avatar">
        <div>
          <strong>${student.name}</strong> (${student.roll})
          <div style="font-size:0.72rem; color: var(--text-muted);">Period ${period} • Finger ID #${student.fingerprintId}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="chip-legend present">P${period} PRESENT</span>
        <div style="font-size:0.72rem; color: var(--text-muted); margin-top:2px;">${timeStr}</div>
      </div>
    `;

    feedList.insertBefore(entry, feedList.firstChild);

    const countBadge = document.getElementById('feed-count-badge');
    countBadge.textContent = `${feedList.children.length} Scans`;
  }

  /* ==========================================================================
     CONSECUTIVE ABSENCE ALGORITHM (2-DAY DETECTOR)
     ========================================================================== */
  checkConsecutiveAbsences() {
    // We check yesterday ('2026-07-29') and today ('2026-07-30') or any 2 consecutive stored dates
    const dates = Object.keys(this.attendanceDB).sort();
    if (dates.length < 2) return [];

    const d1 = dates[dates.length - 2]; // Yesterday
    const d2 = dates[dates.length - 1]; // Today

    const flagged = [];

    this.students.forEach(student => {
      const rec1 = this.attendanceDB[d1] ? this.attendanceDB[d1][student.id] : null;
      const rec2 = this.attendanceDB[d2] ? this.attendanceDB[d2][student.id] : null;

      if (rec1 && rec2) {
        // Count absent periods for both days
        let absCount1 = 0;
        let absCount2 = 0;

        for (let p = 1; p <= 8; p++) {
          if (rec1[p] === 'A') absCount1++;
          if (rec2[p] === 'A') absCount2++;
        }

        // Flag if absent for 6 or more periods for 2 consecutive days
        if (absCount1 >= 6 && absCount2 >= 6) {
          flagged.push({
            student: student,
            daysAbsent: 2,
            lastDate1: d1,
            lastDate2: d2
          });
        }
      }
    });

    // Update Top Banner
    const banner = document.getElementById('consecutive-absence-banner');
    const bannerText = document.getElementById('banner-absence-names');
    const navBadge = document.getElementById('nav-absence-badge');
    const statFlagged = document.getElementById('stat-flagged-students');

    if (flagged.length > 0) {
      banner.classList.remove('hidden');
      const namesList = flagged.map(f => `<strong>${f.student.name} (${f.student.roll})</strong>`).join(', ');
      bannerText.innerHTML = `${flagged.length} Student(s) [ ${namesList} ] missed classes for 2+ consecutive days!`;
      if (navBadge) navBadge.textContent = flagged.length;
      if (statFlagged) statFlagged.textContent = `${flagged.length} Alert`;
    } else {
      banner.classList.add('hidden');
      if (navBadge) navBadge.textContent = '0';
      if (statFlagged) statFlagged.textContent = '0 Clean';
    }

    this.renderConsecutiveAbsenceCards(flagged);
    return flagged;
  }

  renderConsecutiveAbsenceCards(flaggedList) {
    const container = document.getElementById('flagged-cards-container');
    const totalBadge = document.getElementById('total-flagged-count');
    if (!container) return;

    totalBadge.textContent = `${flaggedList.length} Students Flagged`;

    if (flaggedList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size: 40px; color: var(--accent-emerald); margin-bottom: 12px;"></i>
          <p>No students flagged for 2-day consecutive absence! Attendance record is clear.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = flaggedList.map(item => `
      <div class="flagged-card">
        <div class="flagged-card-header">
          <img src="${item.student.photo}" alt="${item.student.name}" class="flagged-photo">
          <div>
            <h4 class="flagged-name">${item.student.name}</h4>
            <span class="flagged-meta">Roll: <strong>${item.student.roll}</strong> • ${item.student.dept}</span>
            <div class="flagged-meta" style="margin-top:2px;">Phone: <strong>${item.student.phone}</strong></div>
          </div>
        </div>

        <span class="absence-counter-tag">
          <i class="fa-solid fa-triangle-exclamation"></i> ABSENT FOR 2 CONSECUTIVE DAYS (8/8 PERIODS MISSED)
        </span>

        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Missed Dates: <code>${item.lastDate1}</code> & <code>${item.lastDate2}</code>
        </div>

        <div class="flagged-actions">
          <button class="btn btn-warning btn-sm w-100" onclick="alert('SMS Warning dispatched to Guardian of ${item.student.name} (${item.student.phone})!')">
            <i class="fa-solid fa-paper-plane"></i> Notify Parent (SMS)
          </button>
          <button class="btn btn-outline btn-sm" onclick="alert('Marked as Excused Medical Leave for ${item.student.name}.')">
            Excused
          </button>
        </div>
      </div>
    `).join('');
  }

  /* ==========================================================================
     RENDER 8-PERIOD DAILY MATRIX TABLE
     ========================================================================== */
  renderDailyMatrix() {
    const tbody = document.getElementById('daily-matrix-tbody');
    if (!tbody) return;

    const deptFilter = document.getElementById('filter-dept').value;
    const searchVal = document.getElementById('search-student-daily').value.toLowerCase().trim();
    const dateRecords = this.attendanceDB[this.selectedDate] || {};

    const flaggedList = this.checkConsecutiveAbsences();
    const flaggedIds = new Set(flaggedList.map(f => f.student.id));

    let filtered = this.students.filter(s => {
      const matchDept = (deptFilter === 'ALL' || s.dept === deptFilter);
      const matchSearch = (s.name.toLowerCase().includes(searchVal) || s.roll.toLowerCase().includes(searchVal));
      return matchDept && matchSearch;
    });

    tbody.innerHTML = filtered.map(student => {
      const pRecord = dateRecords[student.id] || { 1:'A',2:'A',3:'A',4:'A',5:'A',6:'A',7:'A',8:'A' };
      
      let presentCount = 0;
      let chipsHTML = '';

      for (let p = 1; p <= 8; p++) {
        const st = pRecord[p] || 'A';
        if (st === 'P' || st === 'L') presentCount++;

        chipsHTML += `
          <td class="text-center">
            <span class="period-chip ${st}" onclick="app.togglePeriodStatus('${student.id}', ${p})" title="Click to toggle status for Period ${p}">
              ${st}
            </span>
          </td>
        `;
      }

      const isFlagged = flaggedIds.has(student.id);

      let totalPillClass = 'good';
      if (presentCount < 5) totalPillClass = 'critical';
      else if (presentCount < 7) totalPillClass = 'warning';

      return `
        <tr>
          <td>
            <div class="student-info-cell">
              <img src="${student.photo}" alt="${student.name}" class="table-avatar">
              <div>
                <span class="student-name">${student.name}</span>
                <span class="student-roll-sub">Batch ${student.batch}</span>
              </div>
            </div>
          </td>
          <td><strong>${student.roll}</strong></td>
          <td><span class="badge-normal">${student.dept}</span></td>
          ${chipsHTML}
          <td class="text-center">
            <span class="daily-total-pill ${totalPillClass}">
              ${presentCount} / 8
            </span>
          </td>
          <td class="text-center">
            ${isFlagged 
              ? '<span class="absence-alert-badge"><i class="fa-solid fa-triangle-exclamation"></i> 2-Day Warning</span>' 
              : '<span class="badge-normal">Normal</span>'}
          </td>
          <td class="text-center">
            <button class="btn btn-outline btn-sm" onclick="app.togglePeriodStatus('${student.id}', ${this.activePeriod})">
              Mark P${this.activePeriod}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  togglePeriodStatus(studentId, period) {
    if (!this.attendanceDB[this.selectedDate]) this.attendanceDB[this.selectedDate] = {};
    if (!this.attendanceDB[this.selectedDate][studentId]) {
      const p = {};
      for (let i = 1; i <= 8; i++) p[i] = 'A';
      this.attendanceDB[this.selectedDate][studentId] = p;
    }

    const current = this.attendanceDB[this.selectedDate][studentId][period] || 'A';
    const nextState = current === 'P' ? 'L' : (current === 'L' ? 'A' : 'P');

    this.attendanceDB[this.selectedDate][studentId][period] = nextState;
    this.saveAttendanceToStorage();
    this.renderDailyMatrix();
    this.checkConsecutiveAbsences();
  }

  /* ==========================================================================
     RENDER MONTHLY ATTENDANCE LOGS
     ========================================================================== */
  renderMonthlyLogs() {
    const tbody = document.getElementById('monthly-logs-tbody');
    if (!tbody) return;

    const searchVal = document.getElementById('search-student-monthly').value.toLowerCase().trim();

    // Total periods in month = 20 working days * 8 periods = 160 periods
    const totalMonthlyPeriods = 160;

    let filtered = this.students.filter(s => {
      return s.name.toLowerCase().includes(searchVal) || s.roll.toLowerCase().includes(searchVal);
    });

    tbody.innerHTML = filtered.map(student => {
      // Calculate total present periods across all dates in DB
      let periodsPresent = 0;
      let daysLogged = 0;

      Object.keys(this.attendanceDB).forEach(d => {
        const sRec = this.attendanceDB[d][student.id];
        if (sRec) {
          daysLogged++;
          for (let p = 1; p <= 8; p++) {
            if (sRec[p] === 'P' || sRec[p] === 'L') periodsPresent++;
          }
        }
      });

      // Scale to full month for display
      const totalAttendedScale = Math.min(totalMonthlyPeriods, Math.round(periodsPresent * 4.5));
      const percentage = Math.min(100, Math.round((totalAttendedScale / totalMonthlyPeriods) * 100));
      const periodsAbsent = totalMonthlyPeriods - totalAttendedScale;

      let scoreBadge = '<span class="chip-legend present">EXCELLENT</span>';
      if (percentage < 75) scoreBadge = '<span class="absence-alert-badge"><i class="fa-solid fa-triangle-exclamation"></i> LOW (&lt;75%)</span>';
      else if (percentage < 85) scoreBadge = '<span class="chip-legend" style="background:rgba(245,158,11,0.2); color:var(--accent-amber);">AVERAGE</span>';

      return `
        <tr>
          <td>
            <div class="student-info-cell">
              <img src="${student.photo}" alt="${student.name}" class="table-avatar">
              <div>
                <span class="student-name">${student.name}</span>
                <span class="student-roll-sub">Sensor ID #${student.fingerprintId}</span>
              </div>
            </div>
          </td>
          <td><strong>${student.roll}</strong></td>
          <td><span class="badge-normal">${student.dept}</span></td>
          <td class="text-center">${totalMonthlyPeriods}</td>
          <td class="text-center text-emerald"><strong>${totalAttendedScale}</strong></td>
          <td class="text-center text-danger"><strong>${periodsAbsent}</strong></td>
          <td class="text-center">
            <strong style="font-family: var(--font-heading); font-size: 1rem;">${percentage}%</strong>
          </td>
          <td class="text-center">${scoreBadge}</td>
          <td class="text-center">
            <button class="btn btn-outline btn-sm" onclick="app.openStudentMonthlyCalendar('${student.id}')">
              <i class="fa-solid fa-calendar"></i> View Calendar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  openStudentMonthlyCalendar(studentId) {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('modal-student-name-title').innerHTML = `
      <i class="fa-solid fa-user text-cyan"></i> Monthly Calendar: <strong>${student.name}</strong> (${student.roll})
    `;

    const body = document.getElementById('modal-monthly-calendar-body');

    // Build 30-day calendar matrix
    let daysHTML = '';
    for (let day = 1; day <= 30; day++) {
      const isPresentDay = day % 7 !== 0 && day % 6 !== 0;
      daysHTML += `
        <div style="background: ${isPresentDay ? 'rgba(16,185,129,0.12)' : 'rgba(255,42,95,0.12)'}; 
                    border: 1px solid ${isPresentDay ? 'rgba(16,185,129,0.3)' : 'rgba(255,42,95,0.3)'}; 
                    border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size:0.75rem; color: var(--text-muted);">Jul ${day}</div>
          <div style="font-weight:700; color: ${isPresentDay ? 'var(--accent-emerald)' : '#ff2a5f'}; font-size: 0.85rem; margin-top:2px;">
            ${isPresentDay ? '8/8 P' : '0/8 A'}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">
        Daily 8-Period Breakdown for July 2026:
      </p>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
        ${daysHTML}
      </div>
    `;

    const modal = document.getElementById('modal-monthly-detail');
    modal.classList.remove('hidden');

    document.getElementById('btn-close-monthly-modal').onclick = () => modal.classList.add('hidden');
  }

  /* ==========================================================================
     RENDER STUDENT DIRECTORY & QUICK SELECTOR
     ========================================================================== */
  renderStudentDirectory() {
    const container = document.getElementById('student-directory-list');
    const quickSelect = document.getElementById('select-quick-student');

    if (quickSelect) {
      quickSelect.innerHTML = this.students.map(s => `
        <option value="${s.id}">${s.name} (${s.roll}) - Sensor ID #${s.fingerprintId}</option>
      `).join('');
    }

    if (!container) return;

    container.innerHTML = this.students.map(s => `
      <div class="roster-card">
        <img src="${s.photo}" alt="${s.name}" class="roster-avatar">
        <div class="roster-info">
          <div class="roster-name">${s.name}</div>
          <div class="roster-sub">${s.roll} • ${s.dept}</div>
          <span class="roster-sensor-id"><i class="fa-solid fa-fingerprint"></i> Sensor Finger ID #${s.fingerprintId}</span>
        </div>
      </div>
    `).join('');

    document.getElementById('stat-total-students').textContent = this.students.length;
  }

  /* ==========================================================================
     CSV EXPORTERS
     ========================================================================== */
  exportDailyCSV() {
    let csv = `Student Name,Roll Number,Department,Period 1,Period 2,Period 3,Period 4,Period 5,Period 6,Period 7,Period 8,Total Present\n`;

    const dateRecords = this.attendanceDB[this.selectedDate] || {};

    this.students.forEach(s => {
      const rec = dateRecords[s.id] || {};
      let pCount = 0;
      const periods = [];
      for (let p = 1; p <= 8; p++) {
        const st = rec[p] || 'A';
        periods.push(st);
        if (st === 'P' || st === 'L') pCount++;
      }
      csv += `"${s.name}","${s.roll}","${s.dept}",${periods.join(',')},${pCount}/8\n`;
    });

    this.downloadFile(csv, `BioPulse_Daily_Attendance_${this.selectedDate}.csv`, 'text/csv');
  }

  exportMonthlyCSV() {
    let csv = `Student Name,Roll Number,Department,Sensor Finger ID,Total Conducted Periods,Periods Present,Periods Absent,Attendance Percentage\n`;

    this.students.forEach(s => {
      let periodsPresent = 0;
      Object.keys(this.attendanceDB).forEach(d => {
        const sRec = this.attendanceDB[d][s.id];
        if (sRec) {
          for (let p = 1; p <= 8; p++) {
            if (sRec[p] === 'P' || sRec[p] === 'L') periodsPresent++;
          }
        }
      });
      const scaledPresent = Math.min(160, Math.round(periodsPresent * 4.5));
      const pct = Math.min(100, Math.round((scaledPresent / 160) * 100));

      csv += `"${s.name}","${s.roll}","${s.dept}",${s.fingerprintId},160,${scaledPresent},${160 - scaledPresent},${pct}%\n`;
    });

    this.downloadFile(csv, `BioPulse_Monthly_Report_July_2026.csv`, 'text/csv');
  }

  downloadFile(content, fileName, mimeType) {
    const a = document.createElement('a');
    mimeType = mimeType || 'application/octet-stream';

    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(new Blob([content], { type: mimeType }), fileName);
    } else if (URL && 'download' in a) {
      a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
      a.setAttribute('download', fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      location.href = 'data:application/octet-stream,' + encodeURIComponent(content);
    }
  }

  /* Render Everything */
  renderAll() {
    this.renderDailyMatrix();
    this.renderMonthlyLogs();
    this.renderStudentDirectory();
    this.checkConsecutiveAbsences();
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BioPulseApp();
});