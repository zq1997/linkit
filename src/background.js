var boxHtml = null;
var responseCache = {};

var HTTP_STATUS = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing (WebDAV; RFC 2518)',
    103: 'Checkpoint',
    103: 'Early Hints (RFC 8297)',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information (since HTTP/1.1)',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content (RFC 7233)',
    207: 'Multi-Status (WebDAV; RFC 4918)',
    208: 'Already Reported (WebDAV; RFC 5842)',
    218: 'This is fine (Apache Web Server)',
    226: 'IM Used (RFC 3229)',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found (Previously "Moved temporarily")',
    303: 'See Other (since HTTP/1.1)',
    304: 'Not Modified (RFC 7232)',
    305: 'Use Proxy (since HTTP/1.1)',
    306: 'Switch Proxy',
    307: 'Temporary Redirect (since HTTP/1.1)',
    308: 'Permanent Redirect (RFC 7538)',
    400: 'Bad Request',
    401: 'Unauthorized (RFC 7235)',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required (RFC 7235)',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed (RFC 7232)',
    413: 'Payload Too Large (RFC 7231)',
    414: 'URI Too Long (RFC 7231)',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable (RFC 7233)',
    417: 'Expectation Failed',
    418: 'I\'m a teapot (RFC 2324, RFC 7168)',
    419: 'Page Expired (Laravel Framework)',
    420: 'Enhance Your Calm (Twitter)',
    420: 'Method Failure (Spring Framework)',
    421: 'Misdirected Request (RFC 7540)',
    422: 'Unprocessable Entity (WebDAV; RFC 4918)',
    423: 'Locked (WebDAV; RFC 4918)',
    424: 'Failed Dependency (WebDAV; RFC 4918)',
    426: 'Upgrade Required',
    428: 'Precondition Required (RFC 6585)',
    429: 'Too Many Requests (RFC 6585)',
    431: 'Request Header Fields Too Large (RFC 6585)',
    440: 'Login Time-out',
    444: 'No Response',
    449: 'Retry With',
    450: 'Blocked by Windows Parental Controls (Microsoft)',
    451: 'Redirect',
    451: 'Unavailable For Legal Reasons (RFC 7725)',
    494: 'Request header too large',
    495: 'SSL Certificate Error',
    496: 'SSL Certificate Required',
    497: 'HTTP Request Sent to HTTPS Port',
    498: 'Invalid Token (Esri)',
    499: 'Client Closed Request',
    499: 'Token Required (Esri)',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates (RFC 2295)',
    507: 'Insufficient Storage (WebDAV; RFC 4918)',
    508: 'Loop Detected (WebDAV; RFC 5842)',
    509: 'Bandwidth Limit Exceeded (Apache Web Server/cPanel)',
    510: 'Not Extended (RFC 2774)',
    511: 'Network Authentication Required (RFC 6585)',
    520: 'Unknown Error',
    521: 'Web Server Is Down',
    522: 'Connection Timed Out',
    523: 'Origin Is Unreachable',
    524: 'A Timeout Occurred',
    525: 'SSL Handshake Failed',
    526: 'Invalid SSL Certificate',
    526: 'Invalid SSL Certificate',
    527: 'Railgun Error',
    530: 'Origin DNS Error',
    530: 'Site is frozen',
    598: '(Informal convention) Network read timeout error'
};

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

    function responseAndCache(exception = null, responseUrl = null, status = null) {
        var response = {
            exception: exception,
            status: status,
            statusText: null,
            redirected: null,
            valid: null,
            requestUrl: url,
            responseUrl: responseUrl,
        };
        if (exception === null) {
            response.statusText = HTTP_STATUS[status] || '';
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
            responseAndCache(null, this.responseURL, this.status);
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