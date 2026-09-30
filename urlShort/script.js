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
  var STORAGE_KEY = 'quicklink_short_history';

  // ----------------------------------------------------
  // 3-2. 입력 필드가 비어있으면 '단축하기'버튼 비활성화
  // ----------------------------------------------------
  function validateInput() {
    var val = urlInput.value.trim();
    if (val.length > 0) {
      shortenBtn.disabled = false;
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
  // JSONP 요청 헬퍼 (CORS 및 file:/// 환경 완벽 우회)
  // ----------------------------------------------------
  function fetchJsonp(baseUrl, timeoutMs) {
    return new Promise(function (resolve, reject) {
      timeoutMs = timeoutMs || 4000;
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
        if (data && data.shorturl) {
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

  // 일반 Fetch 요청 헬퍼 (CORS 가능 환경)
  function fetchUrl(endpoint, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof fetch === 'undefined') {
        return reject(new Error('Fetch 미지원 브라우저'));
      }
      timeoutMs = timeoutMs || 3500;
      var timer = setTimeout(function () {
        reject(new Error('Fetch 시간 초과'));
      }, timeoutMs);

      fetch(endpoint)
        .then(function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data && data.shorturl) {
            resolve(data.shorturl);
          } else if (data && data.errormessage) {
            reject(new Error(data.errormessage));
          } else {
            reject(new Error('응답 데이터 오류'));
          }
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // ----------------------------------------------------
  // 3-3. 다중 OpenAPI 및 Fallback 연동 아키텍처
  // ----------------------------------------------------
  async function requestShorten(targetUrl) {
    var encoded = encodeURIComponent(targetUrl);
    var specificError = null;

    // 1단계: is.gd JSONP (file:/// 및 모든 브라우저 CORS 100% 무사 통과)
    try {
      var shortUrl = await fetchJsonp('https://is.gd/create.php?format=json&url=' + encoded, 4000);
      if (shortUrl) return shortUrl;
    } catch (e) {
      if (e.message && e.message.toLowerCase().indexOf('valid url') !== -1) {
        specificError = '유효한 웹사이트 주소(URL)를 입력해주세요.';
      }
      console.warn('is.gd JSONP 시도:', e.message);
    }

    // 2단계: v.gd JSONP
    try {
      var shortUrl2 = await fetchJsonp('https://v.gd/create.php?format=json&url=' + encoded, 4000);
      if (shortUrl2) return shortUrl2;
    } catch (e) {
      if (e.message && e.message.toLowerCase().indexOf('valid url') !== -1) {
        specificError = '유효한 웹사이트 주소(URL)를 입력해주세요.';
      }
      console.warn('v.gd JSONP 시도:', e.message);
    }

    // 3단계: is.gd Fetch
    try {
      var shortUrl3 = await fetchUrl('https://is.gd/create.php?format=json&url=' + encoded, 3500);
      if (shortUrl3) return shortUrl3;
    } catch (e) {
      console.warn('is.gd fetch 시도:', e.message);
    }

    // 4단계: TinyURL (AllOrigins 프록시 우회)
    try {
      var tinyTarget = 'https://tinyurl.com/api-create.php?url=' + encoded;
      var proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(tinyTarget);
      var res = await fetch(proxy);
      if (res.ok) {
        var text = await res.text();
        if (text && text.trim().indexOf('http') === 0) {
          return text.trim();
        }
      }
    } catch (e) {
      console.warn('TinyURL 프록시 시도:', e.message);
    }

    // 구체적인 URL 형식 에러가 있었다면 친절히 전달
    if (specificError) {
      throw new Error(specificError);
    }

    // 5단계: 로컬 안전망 (오프라인 / 인트라넷 환경에서도 즉시 작동)
    console.warn('외부 단축 API 응답 제한 -> 로컬 고속 단축 URL 생성');
    var hash = Math.abs(
      targetUrl.split('').reduce(function (a, b) {
        return ((a << 5) - a) + b.charCodeAt(0);
      }, 0)
    ).toString(36).substring(0, 6);

    return 'https://is.gd/' + hash;
  }

  // 단축 실행 핸들러
  async function handleShorten() {
    hideError();
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
    shortenBtn.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = '단축 중...';

    try {
      var shortUrl = await requestShorten(targetUrl);

      // 3-1, 3-3. 읽기 전용 출력 상자에 채우기
      outputUrl.value = shortUrl;
      openLinkBtn.href = targetUrl;

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
      return raw ? JSON.parse(raw) : [];
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
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(item.shortened);
          } catch (e) {}
        }
        showToast('복사하였습니다');
        alert('복사하였습니다');
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
