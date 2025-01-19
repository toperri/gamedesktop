function randomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
function dlgb(id) {
    // what html element is event coming from?
    var element = document.getElementById(id);

    var downloadLink = window[id];

    element.style.color = 'gray';

    element.href = 'javascript:void(0)';

    var base = element.innerHTML.replace('<span>Download</span>', '<span>$MSG$</span>');

    element.innerHTML = base.replace('$MSG$', 'Downloading...');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', downloadLink, true);
    xhr.responseType = 'blob';

    xhr.onprogress = function(event) {
        if (event.lengthComputable) {
            var percentComplete = (event.loaded / event.total) * 100;
            element.innerHTML = base.replace('$MSG$', `Downloading... ${Math.round(percentComplete)}%`);
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            var url = window.URL.createObjectURL(xhr.response);
            var a = document.createElement('a');
            a.href = url;
            a.download = downloadLink.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            element.innerHTML = base.replace('$MSG$', 'Download is complete');
        } else {
            element.innerHTML = base.replace('$MSG$', 'Download failed');
        }
    };

    xhr.onerror = function() {
        element.innerHTML = base.replace('$MSG$', 'Download failed');
    };

    xhr.send();
}
var overrideCSS = document.createElement('style');
overrideCSS.innerHTML = `$CSS$`;
document.head.appendChild(overrideCSS);

document.title = 'GameBanana';

var dragdiv = document.createElement('div');
dragdiv.id = 'dragdiv';
document.body.appendChild(dragdiv);

// todo: hate this code
setTimeout(() => {
    var obj = document.querySelectorAll('.DownloadOptions .GreenColor');
    console.log(obj);
    var i = -1;
    while (i <= obj.length) {
        i++;
        console.log(i, obj[i]);
        obj[i].id = randomString(10);
        window[obj[i].id] = obj[i].href;
        obj[i].href = 'javascript:dlgb("' + obj[i].id + '");';
    }
}, 1000);

document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'ArrowLeft') {
       history.back();
    }
    if (event.ctrlKey && event.key === 'ArrowRight') {
        history.forward();
     }
});

var close = false;

window.onbeforeunload = function(e) {
    console.log('onbeforeunload');
    e.preventDefault();
    if (!close) {
        window.electronAPI.hide();
    }
};