This patch is deprecated!
=

There won’t be no updates, no bugfixes, no compatibility with new Monkey versions.

## How to add WebGL support for mojo now?
I made new implementation of WebGL support for mojo in my Monkey fork - [mungo](http://mungo.io/). It’s a better implementation which gives ~10 time better performance than this patch and works in IE11. Here is a [small demo](http://mungo.io/demo/webgl.html).

Now you can use these two methods to enable WebGL acceleration for your mojo projects:

### 1. Download and install mungo
The fastest way to use new WebGL implementation for mojo is to [download](http://mungo.io/) and install mungo. 

### 2. Create custom HTML5 target
If you don’t want to use mungo you can add WebGL support for mojo by following this short manual:

1. Create a new HTML5 target based on the standard HTML5 monkey target.
2. Rename directory of the new target. For example: html5_webgl
3. There, replace files in modules/native folder by [files](http://source.mungo.io/targets/html5/tree/master/modules/native) from mungo
4. Rename new target in `TARGET.MONKEY` file. For example: `#TARGET_NAME="Html5 WebGL Game"`
5. Copy-paste code from [mojo.html5.webgl.js](http://source.mungo.io/modules/mojo/blob/master/native/mojo.html5.webgl.js) file into `template/main.js` file after `//${TRANSCODE_END}` line
6. Add `#HTML5_WEBGL_ENABLED=True` in `template/CONFIG.MONKEY` file

---

### Mojo HTML5 GL

An experimental patch for [mojo](http://monkeycoder.co.nz/), that replaces the standard 2d-context with WebGL.

### Features

* It does not require code changes
* High SetBlend performance for images
* High SetColor performance for images 
* #MOJO_IMAGE_FILTERING_ENABLED support
* [Chrome Frame](http://www.google.com/chromeframe) support
* It works in browsers that do not support WebGL (2d-context used)
* Small file size - 12KB only!

### Usage

* Just connect [mojo.html5.gl.min.js](https://raw.github.com/devolonter/mojo-html5-gl/master/mojo.html5.gl.min.js) to a page with the game.
* Optional. Enable Chrome Frame support in Internet Explorer. [More info](http://www.chromium.org/developers/how-tos/chrome-frame-getting-started).

### Note

* For V65 and V66 versions use version [v1.21](https://raw.github.com/devolonter/mojo-html5-gl/v1.21/mojo.html5.gl.min.js)
* For versions V64 and below use [v1.11](https://raw.github.com/devolonter/mojo-html5-gl/v1.11/mojo.html5.gl.min.js)


### Demo

* [BunnyMark](http://lab.devolonter.ru/libs/mojo-html5-gl/)
