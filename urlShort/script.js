document.addEventListener('DOMContentLoaded', function () {
  // DOM 요소 참조
  var urlInput = document.getElementById('url-input');
  var clearInputBtn = document.getElementById('clear-input-btn');
  var shortenBtn = document.getElementById('shorten-btn');
  var btnSpinner = document.getElementById('btn-spinner');
  var btnText = document.getElementById('btn-text');
  var shortenForm = document.getElementById('shorten-form');
  var errorMessage = document.getElementById('error-message');
  var errorText = document.getElementById('error-text');
  var resultContainer = document.getElementById('result-container');
  var outputUrl = document.getElementById('output-url');
  var copyBtn = document.getElementById('copy-btn');
  var openLinkBtn = document.getElementById('open-link-btn');
  var makeQrBtn = document.getElementById('make-qr-btn');
  var historyContainer = document.getElementById('history-container');
  var historyList = document.getElementById('history-list');
  var clearHistoryBtn = document.getElementById('clear-history-btn');
  var toast = document.getElementById('toast');
  var toastText = document.getElementById('toast-text');

  // 로컬 스토리지 키
  var STORAGE_KEY = 'quicklink_short_history_api_v2';
  var isLoading = false;

  // ----------------------------------------------------
  // 3-2. 입력 필드가 비어있으면 '단축하기'버튼 비활성화
  // ----------------------------------------------------
  function validateInput() {
    var val = urlInput.value.trim();
    if (val.length > 0) {
      shortenBtn.disabled = isLoading;
      clearInputBtn.style.display = 'flex';
    } else {
      shortenBtn.disabled = true;
      clearInputBtn.style.display = 'none';
    }
  }

  urlInput.addEventListener('input', validateInput);

  clearInputBtn.addEventListener('click', function () {
    urlInput.value = '';
    validateInput();
    urlInput.focus();
    hideError();
  });

  // 에러 메시지 표시/숨김
  function showError(msg) {
    errorText.textContent = msg;
    errorMessage.style.display = 'flex';
  }

  function hideError() {
    errorMessage.style.display = 'none';
  }

  // 토스트 메시지 함수
  var toastTimer = null;
  function showToast(message) {
    toastText.textContent = message || '복사하였습니다';
    toast.classList.add('toast-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('toast-show');
    }, 2500);
  }

  // 입력 URL 검증 및 정규화
  function prepareUrl(rawInput) {
    var url = (rawInput || '').trim();
    if (!url) return null;

    // 프로토콜(http/https) 누락 시 https:// 자동 부여
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      var parsed = new URL(url);
      var host = parsed.hostname || '';
      // 도메인 유효성 검사 (온점이 있거나 localhost인 경우 허용)
      if (!host || (!host.includes('.') && host !== 'localhost')) {
        return {
          valid: false,
          message: '올바른 웹사이트 주소(예: google.com 또는 https://example.com)를 입력해주세요.'
        };
      }
      return { valid: true, url: url };
    } catch (e) {
      return {
        valid: false,
        message: '올바른 URL 형식(예: https://example.com)을 입력해주세요.'
      };
    }
  }

  // ----------------------------------------------------
  // 서비스에서 지원하는 JSONP 요청
  // ----------------------------------------------------
  function fetchJsonp(baseUrl, timeoutMs) {
    return new Promise(function (resolve, reject) {
      timeoutMs = timeoutMs || 12000;
      var callbackName = '_cb_short_' + Math.random().toString(36).substring(2) + '_' + Date.now();
      var script = document.createElement('script');
      var timeoutId = null;

      function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = function (data) {
        cleanup();
        if (data && typeof data.shorturl === 'string' && /^https?:\/\/(is\.gd|v\.gd)\/[A-Za-z0-9_]+$/.test(data.shorturl)) {
          resolve(data.shorturl);
        } else if (data && data.errormessage) {
          reject(new Error(data.errormessage));
        } else {
          reject(new Error('단축 URL 데이터를 수신하지 못했습니다.'));
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('JSONP 네트워크 연결 오류'));
      };

      timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error('요청 시간 초과'));
      }, timeoutMs);

      var sep = baseUrl.indexOf('?') !== -1 ? '&' : '?';
      script.src = baseUrl + sep + 'callback=' + callbackName;
      document.head.appendChild(script);
    });
  }

  // 실제 서비스가 발급한 주소만 반환. 실패 시 주소를 임의 생성하지 않음.
  async function requestShorten(targetUrl) {
    var encoded = encodeURIComponent(targetUrl);
    var endpoints = ['https://is.gd/create.php', 'https://v.gd/create.php'];
    for (var i = 0; i < endpoints.length; i++) {
      try {
        return await fetchJsonp(endpoints[i] + '?format=json&url=' + encoded, 12000);
      } catch (err) {
        console.warn('단축 서비스 응답:', err.message);
      }
    }
    throw new Error('단축 서비스에 연결하지 못했거나 주소가 거절되었습니다. 단축 주소는 생성되지 않았습니다. 인터넷 연결과 입력 주소를 확인하고 잠시 후 다시 시도해주세요.');
  }

  // 단축 실행 핸들러
  async function handleShorten() {
    if (isLoading) return;
    hideError();
    resultContainer.classList.remove('result-visible');
    resultContainer.classList.add('result-hidden');
    outputUrl.value = '';
    openLinkBtn.removeAttribute('href');
    makeQrBtn.onclick = null;
    var rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showError('단축할 URL을 입력해주세요.');
      return;
    }

    var check = prepareUrl(rawUrl);
    if (!check.valid) {
      showError(check.message);
      return;
    }

    var targetUrl = check.url;

    // 로딩 상태 표시
    isLoading = true;
    shortenBtn.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = '단축 중...';

    try {
      var shortUrl = await requestShorten(targetUrl);

      // 3-1, 3-3. 읽기 전용 출력 상자에 채우기
      outputUrl.value = shortUrl;
      openLinkBtn.href = shortUrl;

      // QR코드 생성기로 이동 연동
      makeQrBtn.onclick = function () {
        window.location.href = '../url2qr/index.html?url=' + encodeURIComponent(shortUrl);
      };

      // 결과 영역 표시
      resultContainer.classList.remove('result-hidden');
      resultContainer.classList.add('result-visible');

      // 히스토리 저장
      saveToHistory(targetUrl, shortUrl);

      // 출력 상자 쪽으로 부드럽게 스크롤
      outputUrl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      console.error(err);
      showError(err.message || 'URL을 단축하는 중 문제가 발생했습니다. 주소를 다시 확인해주세요.');
    } finally {
      // 로딩 복구
      isLoading = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = '단축하기';
      validateInput();
    }
  }

  // 폼 제출 이벤트
  shortenForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!shortenBtn.disabled) {
      handleShorten();
    }
  });

  // ----------------------------------------------------
  // 3-4. '복사'버튼을 클릭하면 자동으로 복사하고 '복사하였습니다' 알림창이 나타나게 해줘
  // ----------------------------------------------------
  async function copyShortenedUrl() {
    var textToCopy = outputUrl.value.trim();
    if (!textToCopy) return;

    var copySuccess = false;

    // 1차: 최신 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copySuccess = true;
      } catch (e) {
        console.warn('Clipboard API 실패, 폴백 시도:', e);
      }
    }

    // 2차: execCommand('copy') 폴백
    if (!copySuccess) {
      try {
        outputUrl.select();
        outputUrl.setSelectionRange(0, 99999);
        copySuccess = document.execCommand('copy');
      } catch (e) {
        console.error('execCommand 복사 실패:', e);
      }
    }

    if (copySuccess) {
      // 3-4 요구사항: '복사하였습니다' 알림창
      showToast('복사하였습니다');
      alert('복사하였습니다');
    } else {
      alert('복사에 실패했습니다. 출력 상자의 텍스트를 직접 복사해주세요.');
    }
  }

  copyBtn.addEventListener('click', copyShortenedUrl);

  // ----------------------------------------------------
  // 히스토리(최근 단축 기록) 관리
  // ----------------------------------------------------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items.filter(function (item) {
        return item && typeof item.shortened === 'string' && /^https?:\/\/(is\.gd|v\.gd)\/[A-Za-z0-9_]+$/.test(item.shortened);
      }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(original, shortened) {
    try {
      var history = loadHistory();
      history = history.filter(function (item) {
        return item.shortened !== shortened;
      });
      history.unshift({
        original: original,
        shortened: shortened,
        date: new Date().toISOString()
      });
      if (history.length > 5) history = history.slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      renderHistory();
    } catch (e) {
      console.warn('히스토리 저장 실패:', e);
    }
  }

  function renderHistory() {
    var history = loadHistory();
    if (!history || history.length === 0) {
      historyContainer.style.display = 'none';
      return;
    }

    historyContainer.style.display = 'block';
    historyList.innerHTML = '';

    history.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'history-item';

      var urlsDiv = document.createElement('div');
      urlsDiv.className = 'history-urls';

      var shortLink = document.createElement('a');
      shortLink.className = 'history-short';
      shortLink.href = item.shortened;
      shortLink.target = '_blank';
      shortLink.rel = 'noopener noreferrer';
      shortLink.textContent = item.shortened;

      var origSpan = document.createElement('span');
      origSpan.className = 'history-original';
      origSpan.textContent = item.original;

      urlsDiv.appendChild(shortLink);
      urlsDiv.appendChild(origSpan);

      var copyItemBtn = document.createElement('button');
      copyItemBtn.className = 'history-copy-btn';
      copyItemBtn.textContent = '복사';
      copyItemBtn.onclick = async function () {
        try {
          await navigator.clipboard.writeText(item.shortened);
          showToast('복사하였습니다');
          alert('복사하였습니다');
        } catch (e) {
          window.prompt('아래 주소를 복사해주세요.', item.shortened);
        }
      };

      li.appendChild(urlsDiv);
      li.appendChild(copyItemBtn);
      historyList.appendChild(li);
    });
  }

  clearHistoryBtn.addEventListener('click', function () {
    if (confirm('모든 단축 기록을 삭제하시겠습니까?')) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
    }
  });

  // 초기 히스토리 렌더링
  renderHistory();

  // 동적 마우스 배경 효과
  document.addEventListener('mousemove', function (e) {
    var x = Math.round((e.clientX / window.innerWidth) * 100);
    var y = Math.round((e.clientY / window.innerHeight) * 100);
    document.body.style.setProperty('--mouse-x', x + '%');
    document.body.style.setProperty('--mouse-y', y + '%');
  });

  // 초기 상태 체크
  validateInput();
});
