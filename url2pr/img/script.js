document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url-input');
  const generateBtn = document.getElementById('generate-btn');
  const inputContainer = document.getElementById('input-container');
  const qrContainer = document.getElementById('qr-container');
  const qrcodeDiv = document.getElementById('qrcode');

  const generateQR = () => {
    const url = urlInput.value.trim();
    if (!url) {
      alert('URL을 입력해주세요.');
      return;
    }

    try {
      // Clear previous QR Code if exists
      qrcodeDiv.innerHTML = '';
      
      // Generate QR Code using qrcode.js
      new QRCode(qrcodeDiv, {
        text: url,
        width: 300,
        height: 300,
        colorDark: '#334155',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });

      // Animate layout
      inputContainer.classList.remove('center-pos');
      inputContainer.classList.add('bottom-pos');
      
      qrContainer.classList.remove('qr-hidden');
      qrContainer.classList.add('qr-visible');
      
    } catch (err) {
      console.error(err);
      alert('QR코드 생성 중 오류가 발생했습니다.');
    }
  };

  // Click generate button
  generateBtn.addEventListener('click', generateQR);

  // Press Enter key
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      generateQR();
    }
  });

  // Download QR Code as JPG
  qrcodeDiv.addEventListener('click', () => {
    // qrcode.js appends a canvas and an img to the target div
    const canvas = qrcodeDiv.querySelector('canvas');
    if (!canvas) {
      alert('QR 코드를 찾을 수 없습니다.');
      return;
    }
    
    // Convert canvas to Data URL (JPEG format)
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement('a');
    link.href = image;
    link.download = 'qrcode.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Dynamic Background on Mouse Move
  document.addEventListener('mousemove', (e) => {
    const x = Math.round((e.clientX / window.innerWidth) * 100);
    const y = Math.round((e.clientY / window.innerHeight) * 100);
    document.body.style.setProperty('--mouse-x', `${x}%`);
    document.body.style.setProperty('--mouse-y', `${y}%`);
  });
});
