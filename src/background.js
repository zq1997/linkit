var boxHtml = null;
var responseCache = {};

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
                checkUrl(request.url, request.noCache, request.timeout, sendResponse);
                break;
            default:
                break;
        }
        return true;
    }
);

function checkUrl(url, noCache, timeout, sendResponse) {
    if (!noCache) {
        cache = responseCache[url];
        if (undefined !== cache) {
            sendResponse(cache);
            console.log(url);
            return;
        }
    }

    function responseAndCache(exception, responseUrl = null, status = null, statusText = null) {
        var response = {
            exception: exception,
            status: status,
            statusText: statusText,
            redirected: null,
            valid: null,
            requestUrl: url,
            responseUrl: responseUrl,
        };
        if (exception === null) {
            response.redirected = responseUrl !== url;
            response.valid = status < 400;
        }
        sendResponse(response);
        responseCache[url] = response;
    }

    var xhr = new XMLHttpRequest();
    xhr.timeout = parseInt(timeout * 1000);

    xhr.onreadystatechange = function () {
        if (this.readyState === this.HEADERS_RECEIVED) {
            responseAndCache(null, this.responseURL, this.status, this.statusText);
        }
    };
    xhr.ontimeout = function () {
        responseAndCache('xhr_timeout');
    };
    xhr.onerror = function () {
        responseAndCache('xhr_error');
    };

    xhr.open('HEAD', url, true);
    xhr.send();
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