var boxHtml = null;
var responseCache = {};

var requestQueue = [];
var busyRequests = 0;
var MAX_BUSY_REQUESTS = 10;

function browserActionOnLick(tab) {
    if (boxHtml === null) {
        chrome.runtime.getPackageDirectoryEntry(function (root) {
            root.getFile('box.html', {}, function (fileEntry) {
                fileEntry.file(function (file) {
                    var reader = new FileReader();
                    reader.onloadend = function (event) {
                        boxHtml = event.target.result;
                        browserActionOnLick(tab);
                    };
                    reader.readAsText(file);
                });
            });
        });
    } else {
        chrome.tabs.sendMessage(tab.id, {
            cmd: 'makeBox',
            html: boxHtml
        });
    }
}

chrome.browserAction.onClicked.addListener(browserActionOnLick);

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.cmd) {
            case 'checkUrl':
                request.sendResponse = sendResponse;
                requestQueue.push(request);
                dequeueCheck();
                // checkUrl(request.url, request.noCache, request.timeout, sendResponse);
                break;
            default:
                break;
        }
        return true;
    }
);

function dequeueCheck() {
    if (requestQueue.length <= 0 || busyRequests >= MAX_BUSY_REQUESTS) {
        return;
    }

    var request = requestQueue.shift();
    if (!request.noCache) {
        cache = responseCache[request.url];
        if (undefined !== cache) {
            request.sendResponse(cache);
            setTimeout(dequeueCheck, 0);
            return;
        }
    }
    
    busyRequests += 1;
    var nextHasFired = false;

    function fireNext() {
        if (!nextHasFired) {
            nextHasFired = true;
            busyRequests -= 1;
            dequeueCheck();
        }
    }

    function finish(exception, responseUrl = null, status = null, statusText = null) {
        var response = {
            exception: exception,
            status: status,
            statusText: statusText,
            redirected: null,
            valid: null,
            requestUrl: request.url,
            responseUrl: responseUrl,
        };
        if (exception === null) {
            response.redirected = responseUrl !== request.url;
            response.valid = status < 400;
        }
        responseCache[request.url] = response;
        request.sendResponse(response);
        fireNext();
    }

    var xhr = new XMLHttpRequest();
    xhr.timeout = parseInt(request.timeout * 1000);

    xhr.onreadystatechange = function () {
        if (this.readyState === this.HEADERS_RECEIVED) {
            finish(null, this.responseURL, this.status, this.statusText);
        }
    };
    xhr.ontimeout = function () {
        finish('xhr_timeout');
    };
    xhr.onerror = function () {
        finish('xhr_error');
    };

    xhr.open('HEAD', request.url, true);
    xhr.send();
    // 1秒钟后一定启动下一个请求，防止太多请求同时处于超时状态
    setTimeout(fireNext, 1000);
}

chrome.contextMenus.create({
    title: '查看检查结果',
    contexts: ['link'],
    onclick: function (info, tab) {
        if (Boolean(info.linkUrl)) {
            chrome.tabs.sendMessage(tab.id, {
                cmd: 'showResult',
                url: info.linkUrl
            });
        }
    }
});