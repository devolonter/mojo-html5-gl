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
* It works in browsers that do not support WebGL (2d-context used)
* Small file size - 13KB only!

Known Issues
=
______________________________________________________
* Doesn't work correctly In Opera 12.00 with WebGL turned on

Usage
=
______________________________________________________
Just include [mojo.html5.gl.min.js](https://raw.github.com/devolonter/mojo-html5-gl/master/mojo.html5.gl.min.js) to a page with the game.

Demo
=
______________________________________________________
* [Firepaint](http://lab.devolonter.ru/libs/mojo-html5-gl/)