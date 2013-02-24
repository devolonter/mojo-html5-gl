var mojoHtml5Gl = function(undefined){
	'use strict';

	document.addEventListener("DOMContentLoaded", function() { init("GameCanvas"); }, false);

	var WebGL2D = function WebGL2D(canvas) {
		this.api = undefined;
		this.canvas = canvas;
		this.gl = undefined;
		this.width = canvas.width;
		this.height = canvas.height;
		this.simpleShader = undefined;
		this.textureShader = undefined;
		this.assetsCache = [];
		this.maxTextureSize = undefined;

		canvas.gl2d = this;

		var gl = this.gl = canvas.getContext("webgl", {alpha: false}) || canvas.getContext("experimental-webgl", {alpha: false});

		if (gl === undefined || gl === null) return;

		try {
			this.simpleShader = this.loadShaders(false);
			this.textureShader = this.loadShaders(true);
		} catch (e) { throw e; }
		
		var api = this.api = new WebGL2DAPI(this);
		
		BBMonkeyGame.Main = function( canvas ){
			var game = new BBMonkeyGame( canvas );

			try{
				bbInit();
				bbMain();
			}catch(ex){
				game.Die(ex);
				return;
			}			

			function loadComplete(){
				this.texture = api.createTexture(this);
				game.DecLoading();
				if (game.GetLoading() === 0) game.Run();
			}

			var data = META_DATA.split('\n');
			var path = [];
			var monkeyPath = '';

			for(var i = data.length - 1; i >= 0; i--) {
				path = data[i].match(/\[(.*)\];type=image\//i);
				if (path !== null) {
					monkeyPath = bb_data_FixDataPath(path[1]);
					game.IncLoading();

					var image = new Image();
					image.onload = loadComplete;
					image.meta_width = parseInt(game.GetMetaData(monkeyPath, "width"));
					image.meta_height = parseInt(game.GetMetaData(monkeyPath, "height"));
					image.src = game.PathToUrl(monkeyPath);

					canvas.gl2d.assetsCache[monkeyPath] = new gxtkSurface(image,this);
				}
			}
		}

		canvas.getContext = (function(api) {
			return function(context) {
				return api;
			};
		}(this.api));
	};

	WebGL2D.prototype.getFragmentShaderSource = function getFragmentShaderSource(textured) {
		var fsSource = [];

		fsSource.push(
			"precision mediump float;",
			"varying vec4 vColor;"
		);

		if (textured) {
			fsSource.push(
				"varying vec2 vTextureCoord;",
				"uniform sampler2D uSampler;"
			);
		}

		fsSource.push("void main(void) {");

		if (textured) {
			fsSource.push("gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor;");
		} else {
			fsSource.push("gl_FragColor = vColor;");
		}

		fsSource.push("}");

		return fsSource.join("\n");
	};

	WebGL2D.prototype.getVertexShaderSource = function getVertexShaderSource(textured) {
		var w = 2 / this.canvas.width, h = -2 / this.canvas.height;

		var vsSource = [];

		vsSource.push(
			"attribute vec4 aVertexPosition;",
			"attribute vec4 aVertexColor;",
			"varying vec4 vColor;",
			"const mat4 pMatrix = mat4(" + w + ",0,0,0, 0," + h + ",0,0, 0,0,1.0,1.0, -1.0,1.0,0,0);"
		);

		if (textured) {
			vsSource.push("varying vec2 vTextureCoord;");
		}

		vsSource.push(
			"void main(void) {",
			"vec3 position = vec3(aVertexPosition.x, aVertexPosition.y, 1.0);",
			"gl_Position = pMatrix * vec4(position, 1.0);",
			"vColor = aVertexColor;"
		);

		if (textured) {
			vsSource.push("vTextureCoord = aVertexPosition.zw;");
		}

		vsSource.push("}");

		return vsSource.join("\n");
	};

	WebGL2D.prototype.loadShaders = function loadShaders(textured) {
		var gl = this.gl;

		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, this.getFragmentShaderSource(textured));
		gl.compileShader(fs);

		if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
			throw "fragment shader error: " + gl.getShaderInfoLog(fs);
		}

		var vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, this.getVertexShaderSource(textured));
		gl.compileShader(vs);

		if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
			throw "vertex shader error: " + gl.getShaderInfoLog(vs);
		}

		var shaderProgram = this.shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, fs);
		gl.attachShader(shaderProgram, vs);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			throw "Could not initialise shaders.";
		}

		shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
		gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

		shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
		gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

		shaderProgram.uColor = gl.getUniformLocation(shaderProgram, 'uColor');
		shaderProgram.uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');

		return shaderProgram;
	};	

	var WebGL2DAPI = function WebGL2DAPI(gl2d) {
		if (CFG_CONFIG === "debug") {
			print("WebGL enabled");
		}

		var gl = gl2d.gl;

		gl2d.width = -1;
		gl2d.height = -1;
		gl2d.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		if (!isPOT(gl2d.maxTextureSize)) gl2d.maxTextureSize += 1;

		var MAX_VERTICES = 2048;
		var MAX_RENDERS = parseInt(MAX_VERTICES / 2);

		var red = 1.0, green = 1.0, blue = 1.0;
		var alpha = 1.0, blend = 0;		

		var MODE_NONE = 0, MODE_TEXTURED = 1;
		var mode = MODE_NONE;
		var gxtk = null;

		var simpleShader = gl2d.simpleShader;
		var textureShader = gl2d.textureShader;

		var buffer = {
			vdata: new Float32Array(MAX_VERTICES * 4),
			cdata: new Float32Array(MAX_VERTICES * 4),
			vcount: 0,
			vpointer: 0,
			cpointer: 0,
			vbuffer: gl.createBuffer(),
			cbuffer: gl.createBuffer()
		};

		var render = {
			last: new renderOp(-1, 0, null),
			next: 0
		}

		var rendersPool = new Array(MAX_RENDERS);

		for (var i = 0; i < rendersPool.length; i++) {
			rendersPool[i] = new renderOp(-1, 0, null);
		}

		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);		

		//mojo runtime patching
		gxtkGraphics.prototype.LoadSurface = function(path){
			return gl2d.assetsCache[path];
		}

		gxtkGraphics.prototype.BeginRender = function() {
			if (!this.gc) return 0;

			if (gl2d.width !== gl2d.canvas.width || gl2d.height !== gl2d.canvas.height) {
				simpleShader = gl2d.simpleShader = gl2d.loadShaders(false);
				textureShader = gl2d.textureShader = gl2d.loadShaders(true);

				this.width = gl2d.width = gl2d.canvas.width;
				this.height = gl2d.height = gl2d.canvas.height;
				gl.viewport(0, 0, this.width, this.height);
			}

			gxtk = this;
		}

		gxtkGraphics.prototype.EndRender = function(){
			renderPull();
		}

		gxtkGraphics.prototype.CreateSurface=function( width,height ){
			var canvas = document.createElement("canvas");

			canvas.width = width;
			canvas.height = height;
			canvas.meta_width = width;
			canvas.meta_height = height;
			canvas.texture = gl2d.api.createTexture(canvas);
			canvas.complete = true;

			var surface = new gxtkSurface(canvas, this);
			surface.gc = canvas.getContext("2d");

			return surface;
		}

		gxtkGraphics.prototype.SetAlpha = function(a){
			alpha = a;
		}

		gxtkGraphics.prototype.SetColor = function(r, g, b){
			red = r / 255.0; green = g / 255.0; blue = b / 255.0;
		}

		gxtkGraphics.prototype.SetBlend = function(b){
			if (blend === b) return;
			renderPull();			

			switch (b) {
				case 1:
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
					break;
				default:
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			}

			blend = b;
		}

		gxtkGraphics.prototype.SetScissor = function(x,y,w,h) {
			renderPull();

			if (x !== 0 || y !== 0 || w !== this.width || h !== this.height) {
				gl.enable(gl.SCISSOR_TEST);
				y = this.height - y - h;
				gl.scissor(x, y, w, h);
			} else {
				gl.disable(gl.SCISSOR_TEST);
			}
		}

		gxtkGraphics.prototype.SetMatrix = function(ix, iy, jx, jy, tx, ty) {
			this.ix = ix; this.iy = iy;
			this.jx = jx; this.jy = jy;
			this.tx = tx; this.ty = ty;
			this.tformed = (ix !== 1 || iy !== 0 || jx !== 0 || jy !== 1 || tx !== 0 || ty !== 0);
		}

		gxtkGraphics.prototype.Cls = function(r, g, b) {
			gl.clearColor(r / 255, g / 255, b / 255, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		gxtkGraphics.prototype.DrawPoint = function(x, y){
			if (mode !== MODE_NONE) {
				renderPull();
				mode = MODE_NONE;
			}

			renderPush(gl.POINTS, 1);

			if (this.tformed) {
				var px = x;
				x = px * this.ix + y * this.jx + this.tx;
				y = px * this.iy + y * this.jy + this.ty;
			}

			var p = buffer.vpointer;
			
			buffer.vdata[p] = x;
			buffer.vdata[p + 1] = y;
		}		

		gxtkGraphics.prototype.DrawRect = function(x, y, w, h){
			if (mode !== MODE_NONE) {
				renderPull();
				mode = MODE_NONE;
			}

			renderPushRect(x, y, w, h);
		}

		gxtkGraphics.prototype.DrawLine = function(x1, y1, x2, y2) {
			if (mode !== MODE_NONE) {
				renderPull();
				mode = MODE_NONE;
			}

			renderPush(gl.LINES, 2);

			if (this.tformed) {
				var tx0 = x1, tx1 = x2;
				x1 = tx0 * this.ix + y1 * this.jx + this.tx;
				y1 = tx0 * this.iy + y1 * this.jy + this.ty;
				x2 = tx1 * this.ix + y2 * this.jx + this.tx;
				y2 = tx1 * this.iy + y2 * this.jy + this.ty;
			}

			var p = buffer.vpointer;

			buffer.vdata[p] = x1; 
			buffer.vdata[p + 1] = y1;
			buffer.vdata[p + 2] = 0; 
			buffer.vdata[p + 3] = 0; 
			buffer.vdata[p + 4] = x2; 
			buffer.vdata[p + 5] = y2; 
			buffer.vdata[p + 6] = 0; 
			buffer.vdata[p + 7] = 0;
		}

		gxtkGraphics.prototype.DrawOval = function(x, y, w, h) {
			if (mode !== MODE_NONE) {
				renderPull();
				mode = MODE_NONE;
			}

			var xr = w / 2.0;
			var yr = h / 2.0;

			var segs;

			if (this.tformed) {
				var xx = xr * this.ix, xy = xr * this.iy, xd = parseFloat(Math.sqrt(xx * xx + xy * xy));
				var yx = yr * this.jx, yy = yr * this.jy, yd = parseFloat(Math.sqrt(yx * yx + yy * yy));

				segs= parseInt(xd + yd);
			}else{
				segs = parseInt(Math.abs(xr) + Math.abs(yr));
			}
			

			if (segs > MAX_VERTICES) {
				segs = MAX_VERTICES;
			} else if (segs < 12) {
				segs=12;
			} else {
				segs &=~ 3;
			}
		
			x += xr;
			y += yr;

			renderPush(gl.TRIANGLE_FAN, segs);
			var p = buffer.vpointer;

			for (var i=0; i < segs; i++) {
				var th = i * 6.28318531 / segs;
				var x0 = (x + Math.cos(th) * xr);
				var y0 = (y + Math.sin(th) * yr);

				if (this.tformed){
					var tx0 = x0;

					x0 = tx0 * this.ix + y0 * this.jx + this.tx;
					y0 = tx0 * this.iy + y0 * this.jy + this.ty;
				}

				buffer.vdata[p] = x0;
				buffer.vdata[p + 1] = y0;
				p += 4;
			}
		}	

		gxtkGraphics.prototype.DrawPoly = function(verts) {
			if (mode !== MODE_NONE) {
				renderPull();
				mode = MODE_NONE;
			}

			if (verts.length < 6 || verts.length > MAX_VERTICES * 2) return;
	
			renderPush(gl.TRIANGLE_FAN, verts.length / 2);
			var p = buffer.vpointer;

			if (this.tformed) {
				for (var i = 0; i < verts.length; i += 2) {
					buffer.vdata[p] = verts[i] * this.ix + verts[i + 1] * this.jx + this.tx;
					buffer.vdata[p + 1] = verts[i] * this.iy + verts[i + 1] * this.jy + this.ty;
					p += 4;
				}
			} else {			
				for (var i = 0; i < verts.length; i += 2) {
					buffer.vdata[p] = verts[i];
					buffer.vdata[p + 1] = verts[i + 1];
					p += 4;
				}
			}
		}

		gxtkGraphics.prototype.DrawSurface = function(surface, x, y) {
			if (!surface.image.complete) return;
			if (mode !== MODE_TEXTURED) {
				renderPull();
				mode = MODE_TEXTURED;
			}

			renderPushRect(x, y, surface.swidth, surface.sheight);
			render.last.texture = surface.image.texture;
		}

		gxtkGraphics.prototype.DrawSurface2 = function(surface, x, y, srcx, srcy, srcw, srch) {
			if (!surface.image.complete) return;
			if (mode !== MODE_TEXTURED) {
				renderPull();
				mode = MODE_TEXTURED;
			}

			renderPushRect(x, y, srcw, srch, srcx / surface.image.meta_width,
				srcy / surface.image.meta_height, (srcx + srcw) / surface.image.meta_width, (srcy + srch) / surface.image.meta_height);

			render.last.texture = surface.image.texture;
		}

		gxtkGraphics.prototype.ReadPixels = function(pixels, x, y, width, height, offset, pitch ) {
			renderPull();

			var data = new Uint8Array(width * height * 4);
			gl.readPixels(x, this.height - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

			var i = 0;
			for(var py = height-1; py >= 0; --py) {
				var j = offset + py * pitch;
				for(var px = 0; px < width; ++px) {
					pixels[j++] = (data[i+3]<<24) | (data[i]<<16) | (data[i+1]<<8) | data[i+2];
					i+=4;
				}
			}
		}

		gxtkGraphics.prototype.WritePixels2 = function(surface, pixels, x, y, width, height, offset, pitch){
			var imgData = surface.gc.createImageData(width, height);

			var p = imgData.data, i = 0, j = offset,px,py,argb;

			for(py = 0; py < height; ++py){
				for(px = 0; px < width; ++px){
					argb = pixels[j++];
					p[i] = (argb>>16) & 0xff;
					p[i + 1] = (argb>>8) & 0xff;
					p[i + 2] = argb & 0xff;
					p[i + 3] = (argb>>24) & 0xff;
					i += 4;
				}

				j += pitch - width;
			}

			surface.gc.putImageData(imgData, x, y);

			gl.deleteTexture(surface.image.texture);
			surface.image.texture = gl2d.api.createTexture(surface.image);
		}

		function renderPush(type, count) {
			if (buffer.vcount + count > MAX_VERTICES || render.next === MAX_RENDERS) {
				renderPull();
			}

			render.last = rendersPool[render.next];
			render.next += 1;

			render.last.type = type;
			render.last.count = count;
			render.last.texture = null;

			buffer.vpointer = buffer.vcount * 4;
			buffer.cpointer = buffer.vcount * 4;
			buffer.vcount += count;			

			var p = buffer.cpointer;

			for (var i = 0; i < count; i++) {
				buffer.cdata[p] = red; 
				buffer.cdata[p + 1] = green; 
				buffer.cdata[p + 2] = blue; 
				buffer.cdata[p + 3] = alpha;
				p += 4;
			}
		}

		function renderPull() {
			if (buffer.vcount === 0) return;

			var cTexture = null;
			var index = 0;
			var r;			

			switch (mode) {
				case MODE_NONE:
					gl.useProgram(simpleShader);

					gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbuffer);
					gl.bufferData(gl.ARRAY_BUFFER, buffer.vdata, gl.DYNAMIC_DRAW);
					gl.vertexAttribPointer(simpleShader.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

					gl.bindBuffer(gl.ARRAY_BUFFER, buffer.cbuffer);			
					gl.bufferData(gl.ARRAY_BUFFER, buffer.cdata, gl.DYNAMIC_DRAW);
					gl.vertexAttribPointer(simpleShader.vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

					for (var i = 0; i < render.next; i++) {
						r = rendersPool[i];
						gl.drawArrays(r.type, index, r.count);
						index += r.count;
					}
					break;

				case MODE_TEXTURED:
					gl.useProgram(textureShader);

					gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbuffer);
					gl.bufferData(gl.ARRAY_BUFFER, buffer.vdata, gl.DYNAMIC_DRAW);
					gl.vertexAttribPointer(textureShader.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

					gl.bindBuffer(gl.ARRAY_BUFFER, buffer.cbuffer);			
					gl.bufferData(gl.ARRAY_BUFFER, buffer.cdata, gl.DYNAMIC_DRAW);
					gl.vertexAttribPointer(textureShader.vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

					for (var i = 0; i < render.next; i++) {
						r = rendersPool[i];

						if (cTexture !== r.texture) {
							gl.bindTexture(gl.TEXTURE_2D, r.texture);
							gl.activeTexture(gl.TEXTURE0);
							gl.uniform1i(textureShader.uSampler, 0);

							cTexture = r.texture;
						}

						gl.drawArrays(r.type, index, r.count);

						index += r.count;
					}
					break;
			}

			renderReset();
		}

		function renderReset() {
			buffer.vcount = 0;
			render.next = 0;
		}

		function renderPushRect(x, y, w, h, u0, v0, u1, v1) {
			renderPush(gl.TRIANGLE_FAN, 4);

			var x0 = x, x1 = x + w, x2 = x + w, x3 = x;
			var y0 = y, y1 = y, y2 = y + h, y3 = y + h;
			
			if (gxtk.tformed) {
				var tx0 = x0, tx1 = x1, tx2 = x2, tx3 = x3;
				
				x0 = tx0 * gxtk.ix + y0 * gxtk.jx + gxtk.tx;
				y0 = tx0 * gxtk.iy + y0 * gxtk.jy + gxtk.ty;
				x1 = tx1 * gxtk.ix + y1 * gxtk.jx + gxtk.tx;
				y1 = tx1 * gxtk.iy + y1 * gxtk.jy + gxtk.ty;
				x2 = tx2 * gxtk.ix + y2 * gxtk.jx + gxtk.tx;
				y2 = tx2 * gxtk.iy + y2 * gxtk.jy + gxtk.ty;
				x3 = tx3 * gxtk.ix + y3 * gxtk.jx + gxtk.tx;
				y3 = tx3 * gxtk.iy + y3 * gxtk.jy + gxtk.ty;
			}

			var p = buffer.vpointer;

			if (u0 === undefined) {
				buffer.vdata[p] = x0;
				buffer.vdata[p + 1] = y0;
				buffer.vdata[p + 2] = 0;
				buffer.vdata[p + 3] = 0;
				buffer.vdata[p + 4] = x1;
				buffer.vdata[p + 5] = y1;
				buffer.vdata[p + 6] = 1;
				buffer.vdata[p + 7] = 0;
				buffer.vdata[p + 8] = x2;
				buffer.vdata[p + 9] = y2;
				buffer.vdata[p + 10] = 1;
				buffer.vdata[p + 11] = 1;
				buffer.vdata[p + 12] = x3;
				buffer.vdata[p + 13] = y3;
				buffer.vdata[p + 14] = 0;
				buffer.vdata[p + 15] = 1;
			} else {
				buffer.vdata[p] = x0;
				buffer.vdata[p + 1] = y0;
				buffer.vdata[p + 2] = u0;
				buffer.vdata[p + 3] = v0;
				buffer.vdata[p + 4] = x1;
				buffer.vdata[p + 5] = y1;
				buffer.vdata[p + 6] = u1;
				buffer.vdata[p + 7] = v0;
				buffer.vdata[p + 8] = x2;
				buffer.vdata[p + 9] = y2;
				buffer.vdata[p + 10] = u1;
				buffer.vdata[p + 11] = v1;
				buffer.vdata[p + 12] = x3;
				buffer.vdata[p + 13] = y3;
				buffer.vdata[p + 14] = u0;
				buffer.vdata[p + 15] = v1;
			}

		}

		WebGL2DAPI.prototype.createTexture =  function(image) {
			var texture = gl.createTexture();

			var mojoFilteringEnabled = (typeof(CFG_MOJO_IMAGE_FILTERING_ENABLED) === "undefined" || CFG_MOJO_IMAGE_FILTERING_ENABLED === "true" || CFG_MOJO_IMAGE_FILTERING_ENABLED === "1");

			if (image.width > gl2d.maxTextureSize || image.height > gl2d.maxTextureSize) {
				var canvas = document.createElement("canvas");

				canvas.width  = (image.width  > gl2d.maxTextureSize) ? gl2d.maxTextureSize : image.width;
				canvas.height = (image.height > gl2d.maxTextureSize) ? gl2d.maxTextureSize : image.height;

				var ctx = canvas.getContext("2d");

				ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);

				image = canvas;
			}

			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			if (mojoFilteringEnabled) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			} else {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			}

			if (isPOT(image.width) && isPOT(image.height)) {
				if (mojoFilteringEnabled) {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
					gl.generateMipmap(gl.TEXTURE_2D);
				} else {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
					gl.generateMipmap(gl.TEXTURE_2D);
				}
			} else {
				if (mojoFilteringEnabled) {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				} else {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				}
			}
			
			return texture;
		}

		function isPOT(value) {
			return value > 0 && ((value - 1) & value) === 0;
		}

		function renderOp(type, count, texture) {
			this.type = type;
			this.count = count;
			this.texture = texture;
		}
	}

	function init(id) {
		if (window.WebGLRenderingContext !== undefined) {
			try {
				new WebGL2D(document.getElementById(id));
			} catch (e) { }

		}
	}

};

mojoHtml5Gl();