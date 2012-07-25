Mojo HTML5 GL
=
______________________________________________________
An experimental patch for [mojo](http://monkeycoder.co.nz/), that replaces the standard 2d-context with WebGL. The patch is based on the library [WebGL-2D](https://github.com/gameclosure/webgl-2d).

Features
=
______________________________________________________
* It does not require code changes
* High SetBlend performance 
* High SetColor performance for images 
* #MOJO_IMAGE_FILTERING_ENABLED support
* Support [IEWebGL](http://iewebgl.com/) and [Chrome Frame](http://www.google.com/chromeframe)
* It works in browsers that do not support WebGL (2d-context used)
* Small file size - 14KB only!

Usage
=
______________________________________________________
* Just connect [mojo.html5.gl.min.js](https://raw.github.com/devolonter/mojo-html5-gl/master/mojo.html5.gl.min.js) to a page with the game.
* Optional. Enable Chrome Frame support in Internet Explorer. [More info](http://www.chromium.org/developers/how-tos/chrome-frame-getting-started).

Demo
=
______________________________________________________
* [Firepaint](http://lab.devolonter.ru/libs/mojo-html5-gl/)