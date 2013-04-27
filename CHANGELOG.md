Changelog
=
______________________________________________________
### v1.32
* Improved texture loading
* Added support of Discard method
* Fixed possible bugs which caused crash of the application with an error: "Cannot call method 'IncLoading' of undefined"
* Small improvements

### v1.31
* Work with resizable canvas was fixed
* Small improvements

### v1.30
* **Important!** This version is only compatible with V67
* Now script preloads all textures. Therefore, there might be a short pause before the game start
* Added full support of CreateImage and WritePixels
* In debug mode to the console was added notification. Now, if the script was connected successfully, it writes to the console "WebGL enabled"
* Shaders loading was simplified 
* WebGL support detection was improved 
* IEWebGL support  was disabled
* Version tags were added to the repository 
* Updated demo
* Fixed some bugs

###v1.21
* Added possibility to use by 3rd party modules

###v1.20
* Added color buffer. 2x performance improvement for SetColor and SetAlpha
* Performance improvement  for DrawImageRect function

###v1.14
* DrawOval, DrawLine transformation bug fixed

###v1.13
* Added support of reading/writing pixels

###v1.12
* Added compatibility with V65's app config settings system

###v1.11
* Fixed bug with incorrect max texture size value

###v1.10
* Performance improvement (in some cases five times over improvement).
* Rendering system was fully rewritten. Now, the script isn't based on WebGL2D and doesn’t emulate 2d context. It fully overrides all mojo graphics functions.
* Now, Opera 12.x uses a 3d context
* Script size was reduced

###v1.02
* All known issues were resolved 
* IEWebGL and Chrome Frame support added 
* Bug fixes

###v1.01
* Support of SetScissor, DrawCircle, DrawEllipse and DrawOval methods was added
* Some bugs fixed

###v1.00
* Initial release
