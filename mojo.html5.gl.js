(function(){

	document.addEventListener("DOMContentLoaded", function() { init("GameCanvas"); }, false);

	var M_PI = 3.1415926535897932384626433832795028841968;
	var M_TWO_PI = 2.0 * M_PI;
	var M_HALF_PI = M_PI / 2.0;

	var WebGL2D = this.WebGL2D = function WebGL2D(canvas) {
		this.canvas = canvas;
		this.gl = undefined;
		this.fs = undefined;
		this.vs = undefined;
		this.shaderProgram = undefined;
		this.transform = new Transform();
		this.shaderPool = [];
		this.maxTextureSize = undefined;
		this.width;
		this.height;

		canvas.gl2d = this;

		var gl = this.gl = canvas.getContext("webgl", {alpha: false}) || canvas.getContext("experimental-webgl", {alpha: false});

		if ((typeof(gl) === "undefined") || (gl === null)) return;

		try {
			this.initShaders();
		} catch (e) { throw e; }

		canvas.getContext = (function(gl2d) {
			return function(context) {
				return new WebGL2DAPI(gl2d);
			};
		}(this));
	};

	var shaderMask = {
		texture: 1,
		crop: 2,
		path: 4
	};

	WebGL2D.prototype.getFragmentShaderSource = function getFragmentShaderSource(sMask) {
		var fsSource = [
			"#ifdef GL_ES",
				"precision highp float;",
			"#endif",

			"#define hasTexture " + ((sMask&shaderMask.texture) ? "1" : "0"),
			"#define hasCrop " + ((sMask&shaderMask.crop) ? "1" : "0"),

			"varying vec4 vColor;",

			"#if hasTexture",
				"varying vec2 vTextureCoord;",
				"uniform sampler2D uSampler;",
				"#if hasCrop",
					"uniform vec4 uCropSource;",
				"#endif",
			"#endif",

			"void main(void) {",
				"#if hasTexture",
					"#if hasCrop",
						"gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x * uCropSource.z, vTextureCoord.y * uCropSource.w) + uCropSource.xy) * vColor;",
					"#else",
						"gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor;",
					"#endif",
				"#else",
					"gl_FragColor = vColor;",
				"#endif",
			"}"
		].join("\n");

		return fsSource;
	};

	WebGL2D.prototype.getVertexShaderSource = function getVertexShaderSource(stackDepth,sMask) {
		var w = 2 / this.canvas.width, h = -2 / this.canvas.height;

		stackDepth = stackDepth || 1;

		var vsSource = [
			"#define hasTexture " + ((sMask&shaderMask.texture) ? "1" : "0"),
			"attribute vec4 aVertexPosition;",

			"#if hasTexture",
			"varying vec2 vTextureCoord;",
			"#endif",

			"uniform vec4 uColor;",
			"uniform mat3 uTransforms[" + stackDepth + "];",

			"varying vec4 vColor;",

			"const mat4 pMatrix = mat4(" + w + ",0,0,0, 0," + h + ",0,0, 0,0,1.0,1.0, -1.0,1.0,0,0);",

			"mat3 crunchStack(void) {",
				"mat3 result = uTransforms[0];",
				"for (int i = 1; i < " + stackDepth + "; ++i) {",
					"result = uTransforms[i] * result;",
				"}",
				"return result;",
			"}",

			"void main(void) {",
				"vec3 position = crunchStack() * vec3(aVertexPosition.x, aVertexPosition.y, 1.0);",
				"gl_Position = pMatrix * vec4(position, 1.0);",
				"vColor = uColor;",
				"#if hasTexture",
					"vTextureCoord = aVertexPosition.zw;",
				"#endif",
			"}"
		].join("\n");

		return vsSource;
	};

	WebGL2D.prototype.initShaders = function initShaders(transformStackDepth,sMask) {
		var gl = this.gl;

		transformStackDepth = transformStackDepth || 1;
		sMask = sMask || 0;
		var storedShader = this.shaderPool[transformStackDepth];

		if (!storedShader) { storedShader = this.shaderPool[transformStackDepth] = []; }
		storedShader = storedShader[sMask];

		if (storedShader) {
			gl.useProgram(storedShader);
			this.shaderProgram = storedShader;
			return storedShader;
		} else {
			var fs = this.fs = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(this.fs, this.getFragmentShaderSource(sMask));
			gl.compileShader(this.fs);

			if (!gl.getShaderParameter(this.fs, gl.COMPILE_STATUS)) {
				throw "fragment shader error: "+gl.getShaderInfoLog(this.fs);
			}

			var vs = this.vs = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(this.vs, this.getVertexShaderSource(transformStackDepth,sMask));
			gl.compileShader(this.vs);

			if (!gl.getShaderParameter(this.vs, gl.COMPILE_STATUS)) {
				throw "vertex shader error: "+gl.getShaderInfoLog(this.vs);
			}

			var shaderProgram = this.shaderProgram = gl.createProgram();
			shaderProgram.stackDepth = transformStackDepth;
			gl.attachShader(shaderProgram, fs);
			gl.attachShader(shaderProgram, vs);
			gl.linkProgram(shaderProgram);

			if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
				throw "Could not initialise shaders.";
			}

			gl.useProgram(shaderProgram);

			shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
			gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

			shaderProgram.uColor = gl.getUniformLocation(shaderProgram, 'uColor');
			shaderProgram.uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');
			shaderProgram.uCropSource = gl.getUniformLocation(shaderProgram, 'uCropSource');

			shaderProgram.uTransforms = [];
			for (var i=0; i<transformStackDepth; ++i) {
				shaderProgram.uTransforms[i] = gl.getUniformLocation(shaderProgram, 'uTransforms[' + i + ']');
			}
			this.shaderPool[transformStackDepth][sMask] = shaderProgram;
			return shaderProgram;
		}
	};	

	var WebGL2DAPI = this.WebGL2DAPI = function WebGL2DAPI(gl2d) {
		var gl = gl2d.gl;

		gl2d.width = gl2d.canvas.width;
		gl2d.height = gl2d.canvas.height;

		var red = 1.0, green = 1.0, blue = 1.0; ARGB = 0xFFFFFFFF;
		var alpha = 1.0, blend = 0;

		var MAX_VERTICES = parseInt(65536 / 20);
		var MAX_RENDERS = parseInt(MAX_VERTICES / 2);

		var buffer = {
			vdata: new Float32Array(new Array(MAX_VERTICES * 4)),
			vcount: 0,
			vpointer: 0,
			cpointer: 0,
			pointer: gl.createBuffer()
		};

		var render = {
			last: {type: -1, count: 0},
			next: 0
		}

		var rendersPull = new Array(MAX_RENDERS);

		for (var i = 0; i < rendersPull.length; i++) {
			rendersPull[i] = {
				type: -1,
				count: 0,
				surface: null,
				sMask: 0,
				cStack: 0,
				x: 0, y: 0, width: 0, height: 0,
				r: red, g: green, b: blue, a: alpha, argb: ARGB
			}
		}		

		var rectVertexPositionBuffer;
		var pathVertexPositionBuffer;

		var rectVerts = new Float32Array([
			0,0, 0,0,
			0,1, 0,1,
			1,1, 1,1,
			1,0, 1,0
		]);		

		rectVertexPositionBuffer = gl.createBuffer();
		pathVertexPositionBuffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, rectVertexPositionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, rectVerts, gl.STATIC_DRAW);

		gl.viewport(0, 0, gl2d.width, gl2d.height);

		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl2d.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

		function renderPush(type, count) {
			if (buffer.vcount + count > MAX_VERTICES || render.next === MAX_RENDERS) {
				renderPull();
			}

			render.last = rendersPull[render.next];
			render.next += 1;
			render.last.type = type;
			render.last.count = count;
			render.last.cStack = gl2d.transform.c_stack;
			render.last.r = red;
			render.last.g = green;
			render.last.b = blue;
			render.last.a = alpha;
			render.last.argb = ARGB;

			buffer.vpointer = buffer.vcount * 4;
			buffer.cpointer = buffer.vcount;
			buffer.vcount += count;
		}

		function renderPull() {
			if (buffer.vcount === 0) return;

			var transform = gl2d.transform;
			var cStack = -1;
			var cARGB = 0;

			gl.bindBuffer(gl.ARRAY_BUFFER, buffer.pointer);
			gl.bufferData(gl.ARRAY_BUFFER, buffer.vdata, gl.DYNAMIC_DRAW);

			var shaderProgram;
			var index = 0;

			for (var i = 0; i < render.next; i++) {
				var r = rendersPull[i];

				if (cStack !== r.cStack) {
					shaderProgram = gl2d.initShaders(r.cStack + 2, 0);

					gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);
					gl.uniform4f(shaderProgram.uColor, red, green, blue, alpha);
					cARGB = ARGB;

					sendTransformStack(shaderProgram);
					cStack = r.cStack;
				}

				if (cARGB !== r.argb) {
					gl.uniform4f(shaderProgram.uColor, r.r, r.g, r.b, r.a);
					cARGB = r.argb;
				}

				gl.drawArrays(r.type, index, r.count);
				index += r.count;
			}

			renderReset();
		}

		function renderReset() {
			buffer.vcount = 0;
			render.next = 0;
		}

		//mojo runtime patching
		gxtkGraphics.prototype.BeginRender = function() {
			if (this.gc) {
				if (gl2d.width !== this.Width() || gl2d.height !== this.Height()) {
					gl2d.shaderPool = [];
					gl2d.initShaders();

					gl2d.width = this.Width();
					gl2d.height = this.Height();
					gl.viewport(0, 0, gl2d.width, gl2d.height);
				}
				this.gc.save();
			}
		}

		gxtkGraphics.prototype.EndRender = function(){
			if(this.gc) {
				renderPull();
				this.gc.restore();
			}
		}

		gxtkGraphics.prototype.SetAlpha = function( a ){
			alpha = a;
			ARGB = (a << 24) | ((blue * 255) << 16) | ((green * 255) << 8) | red * 255;
		}

		gxtkGraphics.prototype.SetColor = function(r, g, b){
			red = r / 255.0;
			green = g / 255.0;
			blue = b / 255.0;
			ARGB = (alpha << 24) | (b << 16) | (g << 8) | r;
		}

		gxtkGraphics.prototype.SetBlend = function(b){
			if (blend === b) return;
			renderPull();

			blend = b;

			switch (blend) {
				case 1:
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
					break;
				default:
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			}
		}

		gxtkGraphics.prototype.SetScissor = function(x,y,w,h) {
			renderPull();

			if (x !== 0 || y !== 0 || w !== this.Width() || h !== this.Height()) {
				gl.enable(gl.SCISSOR_TEST);
				y = this.Height() - y - h;
				gl.scissor(x, y, w, h);
			} else {
				gl.disable(gl.SCISSOR_TEST);
			}
		}

		gxtkGraphics.prototype.Cls = function(r, g, b) {
			gl.clearColor(r / 255.0, g / 255.0, b / 255.0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT );
		}

		gxtkGraphics.prototype.DrawLine = function(x1,y1,x2,y2) {
			renderPush(gl.LINES, 2);

			if( this.tformed ){
				var x1_t = x1 * this.ix + y1 * this.jx + this.tx;
				var y1_t = x1 * this.iy + y1 * this.jy + this.ty;
				var x2_t = x2 * this.ix + y2 * this.jx + this.tx;
				var y2_t = x2 * this.iy + y2 * this.jy + this.ty;

				buffer.vdata[buffer.vpointer] = x1_t; buffer.vdata[buffer.vpointer + 1] = y1_t;
				buffer.vdata[buffer.vpointer + 2] = 0; buffer.vdata[buffer.vpointer + 3] = 0; 
				buffer.vdata[buffer.vpointer + 4] = x2_t; buffer.vdata[buffer.vpointer + 5] = y2_t; 
				buffer.vdata[buffer.vpointer + 6] = 0; buffer.vdata[buffer.vpointer + 7] = 0;				
			} else {
				buffer.vdata[buffer.vpointer] = x1; buffer.vdata[buffer.vpointer + 1] = y1;
				buffer.vdata[buffer.vpointer + 2] = 0; buffer.vdata[buffer.vpointer + 3] = 0; 
				buffer.vdata[buffer.vpointer + 4] = x2; buffer.vdata[buffer.vpointer + 5] = y2; 
				buffer.vdata[buffer.vpointer + 6] = 0; buffer.vdata[buffer.vpointer + 7] = 0;
			}						
		}

		gxtkGraphics.prototype.DrawPoly = function(verts) {
			if (verts.length < 6 || verts.length > MAX_VERTICES * 2) return;
	
			renderPush(gl.TRIANGLE_FAN, verts.length / 2);
			
			if (this.tformed) {
				for (var i = 0; i < verts.length; i += 2) {
					buffer.vdata[buffer.vpointer] = verts[i] * this.ix + verts[i + 1] * this.jx + this.tx;
					buffer.vdata[buffer.vpointer + 1] = verts[i] * this.iy + verts[i + 1] * this.jy + this.ty;
					buffer.vpointer += 4;
				}
			} else {
				for (var i = 0; i < verts.length; i += 2) {
					buffer.vdata[buffer.vpointer] = verts[i];
					buffer.vdata[buffer.vpointer + 1] = verts[i + 1];
					buffer.vpointer += 4;
				}
			}
		}

		gxtkGraphics.prototype.DrawSurface = function(surface,x,y) {
			if (!surface.image.complete) return;			
			this.gc.drawImage(surface.image,x,y);
		}

		gxtkGraphics.prototype.DrawSurface2 = function(surface,x,y,srcx,srcy,srcw,srch) {
			if (!surface.image.complete) return;

			if (srcw < 0) { srcx+=srcw;srcw=-srcw; }
			if (srch < 0) { srcy+=srch;srch=-srch; }
			if (srcw <= 0 || srch <= 0) return;

			this.gc.drawImage( surface.image,srcx,srcy,srcw,srch,x,y,srcw,srch );
		}		

		this.save = function save() {
			gl2d.transform.pushMatrix();
		};

		this.restore = function restore() {
			gl2d.transform.popMatrix();
		};

		this.translate = function translate(x, y) {
			gl2d.transform.translate(x, y);
		};

		var rotate = function rotate(a) {
			gl2d.transform.rotate(a);
		};

		this.scale = function scale(x, y) {
			gl2d.transform.scale(x, y);
		};

		this.transform = function transform(m11, m12, m21, m22, dx, dy) {
			var m = gl2d.transform.m_stack[gl2d.transform.c_stack];

			m[0] = m11;
			m[1] = m12;
			m[3] = m21;
			m[4] = m22;
			m[6] = dx;
			m[7] = dy;
		};

		function sendTransformStack(sp) {
			var stack = gl2d.transform.m_stack;
			for (var i = 0, maxI = gl2d.transform.c_stack + 1; i < maxI; ++i) {
				gl.uniformMatrix3fv(sp.uTransforms[i], false, stack[maxI-1-i]);
			}
		};

		this.setTransform = function setTransform(m11, m12, m21, m22, dx, dy) {
			gl2d.transform.setIdentity();
			this.transform.apply(this, arguments);
		};

		this.fillRect = function fillRect(x, y, width, height) {
			var transform = gl2d.transform;
			var shaderProgram = gl2d.initShaders(transform.c_stack+2,0);

			
			gl.bindBuffer(gl.ARRAY_BUFFER, rectVertexPositionBuffer);
			gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

			transform.pushMatrix();

			transform.translate(x, y);
			transform.scale(width, height);

			sendTransformStack(shaderProgram);

			gl.uniform4f(shaderProgram.uColor, red, green, blue, alpha);

			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

			transform.popMatrix();
		};

		var subPaths = [];

		function SubPath(x, y) {
			this.closed = false;
			this.verts = [x, y, 0, 0];
		};

		var beginPath = this.beginPath = function beginPath() {
      		subPaths.length = 0;
		};

		var closePath = this.closePath = function closePath() {
			if (subPaths.length) {
				var prevPath = subPaths[subPaths.length -1], startX = prevPath.verts[0], startY = prevPath.verts[1];
				prevPath.closed = true;

				var newPath = new SubPath(startX, startY);
				subPaths.push(newPath);
			}
		};

		var moveTo = this.moveTo = function moveTo(x, y) {
			subPaths.push(new SubPath(x, y));
		};

		var lineTo = this.lineTo = function lineTo(x, y) {
			if (subPaths.length) {
				subPaths[subPaths.length - 1].verts.push(x, y, 0, 0);
			} else {
				moveTo(x, y);
			}
	    };

		this.rect = function rect(x, y, w, h) {
			moveTo(x, y);
			lineTo(x + w, y);
			lineTo(x + w, y + h);
			lineTo(x, y + h);
			closePath();
		};

		this.arc = function arc(x, y, radius, startAngle, endAngle, anticlockwise) {
			//startAngle, endAngle, anticlockwise not implemented

			if (!subPaths.length) {
				moveTo(x, y + radius);
				
				var step = M_HALF_PI * 0.1;
				var verts = subPaths[0].verts;
				
				for (var i = step; i < M_TWO_PI; i+= step) {
					verts.push(x + Math.sin(i) * radius, y + Math.cos(i) * radius, 0, 0);
				}
			} else {
				var step = M_HALF_PI * 0.1;
				var verts = subPaths[subPaths.length - 1].verts;
				
				for (var i = 0; i < 360; i+= step) {
					verts.push(x + Math.sin(i) * radius, y + Math.cos(i) * radius, 0, 0);
				}
			}
		};

		function fillSubPath(index) {
			var transform = gl2d.transform;
			var shaderProgram = gl2d.initShaders(transform.c_stack + 2,0);

			var subPath = subPaths[index];
			var verts = subPath.verts;

			gl.bindBuffer(gl.ARRAY_BUFFER, pathVertexPositionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

			gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

			transform.pushMatrix();

			sendTransformStack(shaderProgram);

			gl.uniform4f(shaderProgram.uColor, red, green, blue, alpha);

			gl.drawArrays(gl.TRIANGLE_FAN, 0, verts.length/4);

			transform.popMatrix();
		}		

		this.fill = function fill() {
			for(var i = 0; i < subPaths.length; i++) {
				fillSubPath(i);
			}
		};

		function strokeSubPath(index) {
			var transform = gl2d.transform;
			var shaderProgram = gl2d.initShaders(transform.c_stack + 2,0);

			var subPath = subPaths[index];
			var verts = subPath.verts;

			gl.bindBuffer(gl.ARRAY_BUFFER, pathVertexPositionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

			gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

			transform.pushMatrix();

			sendTransformStack(shaderProgram);

			gl.uniform4f(shaderProgram.uColor, red, green, blue, alpha);

			if (subPath.closed) {
				gl.drawArrays(gl.LINE_LOOP, 0, verts.length/4);
			} else {
				gl.drawArrays(gl.LINE_STRIP, 0, verts.length/4);
			}

			transform.popMatrix();
		}

		this.stroke = function stroke() {
			for(var i = 0; i < subPaths.length; i++) {
				strokeSubPath(i);
			}
		};

		this.clip = function clip() {};

		var imageCache = [], textureCache = [];

		function Texture(image) {
			this.obj = gl.createTexture();
			this.index = textureCache.push(this);

			var mojoFilteringEnabled = (typeof(CFG_MOJO_IMAGE_FILTERING_ENABLED) === "undefined" || CFG_MOJO_IMAGE_FILTERING_ENABLED === "true");

			imageCache.push(image);

			if (image.width > gl2d.maxTextureSize || image.height > gl2d.maxTextureSize) {
				var canvas = document.createElement("canvas");

				canvas.width  = (image.width  > gl2d.maxTextureSize) ? gl2d.maxTextureSize : image.width;
				canvas.height = (image.height > gl2d.maxTextureSize) ? gl2d.maxTextureSize : image.height;

				var ctx = canvas.getContext("2d");

				ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);

				image = canvas;
			}

			gl.bindTexture(gl.TEXTURE_2D, this.obj);
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

			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		this.drawImage = function drawImage(image, a, b, c, d, e, f, g, h) {
			var transform = gl2d.transform;

			transform.pushMatrix();

			var sMask = shaderMask.texture;
			var doCrop = false;

			if (arguments.length === 3) {
				transform.translate(a, b);
				transform.scale(image.width, image.height);
			}

			else if (arguments.length === 5) {
				transform.translate(a, b);
				transform.scale(c, d);
			}

			else if (arguments.length === 9) {
				transform.translate(e, f);
				transform.scale(g, h);
				sMask = sMask|shaderMask.crop;
				doCrop = true;
			}

			var shaderProgram = gl2d.initShaders(transform.c_stack, sMask);

			var texture, cacheIndex = imageCache.indexOf(image);

			if (cacheIndex !== -1) {
				texture = textureCache[cacheIndex];
			} else {
				texture = new Texture(image);
			}

			if (doCrop) {
				gl.uniform4f(shaderProgram.uCropSource, a/image.width, b/image.height, c/image.width, d/image.height);
			}

			gl.bindBuffer(gl.ARRAY_BUFFER, rectVertexPositionBuffer);
			gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 4, gl.FLOAT, false, 0, 0);

			gl.bindTexture(gl.TEXTURE_2D, texture.obj);
			gl.activeTexture(gl.TEXTURE0);

			gl.uniform1i(shaderProgram.uSampler, 0);

			sendTransformStack(shaderProgram);

			gl.uniform4f(shaderProgram.uColor, red, green, blue, alpha);

			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

			transform.popMatrix();
		};
	}

	function isPOT(value) {
		return value > 0 && ((value - 1) & value) === 0;
	}

	var vec3 = {
		length: function(pt) {
			return Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2]);
		},

		normalize: function(pt) {
			var d = Math.sqrt((pt[0] * pt[0]) + (pt[1] * pt[1]) + (pt[2] * pt[2]));
			if (d === 0) {
				return [0, 0, 0];
			}
			return [pt[0] / d, pt[1] / d, pt[2] / d];
		},

		dot: function(v1, v2) {
			return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
		},

		angle: function(v1, v2) {
			return Math.acos((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]) * Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2])));
		},

		cross: function(vectA, vectB) {
			return [vectA[1] * vectB[2] - vectB[1] * vectA[2], vectA[2] * vectB[0] - vectB[2] * vectA[0], vectA[0] * vectB[1] - vectB[0] * vectA[1]];
		},

		multiply: function(vectA, constB) {
			return [vectA[0] * constB, vectA[1] * constB, vectA[2] * constB];
		},

		add: function(vectA, vectB) {
			return [vectA[0] + vectB[0], vectA[1] + vectB[1], vectA[2] + vectB[2]];
		},

		subtract: function(vectA, vectB) {
			return [vectA[0] - vectB[0], vectA[1] - vectB[1], vectA[2] - vectB[2]];
		},

		equal: function(a, b) {
			var epsilon = 0.0000001;
			if ((a === undefined) && (b === undefined)) {
				return true;
			}
			if ((a === undefined) || (b === undefined)) {
				return false;
			}
			return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon && Math.abs(a[2] - b[2]) < epsilon);
		}
	};

	var mat3 = {
		identity: [1.0, 0.0, 0.0,
					 0.0, 1.0, 0.0,
					 0.0, 0.0, 1.0],

		multiply: function (m1, m2) {
			var m10 = m1[0], m11 = m1[1], m12 = m1[2], m13 = m1[3], m14 = m1[4], m15 = m1[5], m16 = m1[6], m17 = m1[7], m18 = m1[8],
					m20 = m2[0], m21 = m2[1], m22 = m2[2], m23 = m2[3], m24 = m2[4], m25 = m2[5], m26 = m2[6], m27 = m2[7], m28 = m2[8];

			m2[0] = m20 * m10 + m23 * m11 + m26 * m12;
			m2[1] = m21 * m10 + m24 * m11 + m27 * m12;
			m2[2] = m22 * m10 + m25 * m11 + m28 * m12;
			m2[3] = m20 * m13 + m23 * m14 + m26 * m15;
			m2[4] = m21 * m13 + m24 * m14 + m27 * m15;
			m2[5] = m22 * m13 + m25 * m14 + m28 * m15;
			m2[6] = m20 * m16 + m23 * m17 + m26 * m18;
			m2[7] = m21 * m16 + m24 * m17 + m27 * m18;
			m2[8] = m22 * m16 + m25 * m17 + m28 * m18;
		},

		vec2_multiply: function (m1, m2) {
			var mOut = [];
			mOut[0] = m2[0] * m1[0] + m2[3] * m1[1] + m2[6];
			mOut[1] = m2[1] * m1[0] + m2[4] * m1[1] + m2[7];
			return mOut;
		},

		transpose: function (m) {
			return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
		}
	};

	function Transform(mat) {
		return this.clearStack(mat);
	}

	var STACK_DEPTH_LIMIT = 16;

	Transform.prototype.clearStack = function(init_mat) {
		this.m_stack = [];
		this.m_cache = [];
		this.c_stack = 0;
		this.valid = 0;
		this.result = null;

		for (var i = 0; i < STACK_DEPTH_LIMIT; i++) {
			this.m_stack[i] = this.getIdentity();
		}

		if (init_mat !== undefined) {
			this.m_stack[0] = init_mat;
		} else {
			this.setIdentity();
		}
	};

	Transform.prototype.setIdentity = function() {
		this.m_stack[this.c_stack] = this.getIdentity();
		if (this.valid === this.c_stack && this.c_stack) {
			this.valid--;
		}
	};

	Transform.prototype.getIdentity = function() {
		return [1.0, 0.0, 0.0,
				0.0, 1.0, 0.0,
				0.0, 0.0, 1.0];
	};

	Transform.prototype.getResult = function() {
		if (!this.c_stack) {
			return this.m_stack[0];
		}

		var m = mat3.identity;

		if (this.valid > this.c_stack-1) { this.valid = this.c_stack-1; }

		for (var i = this.valid; i < this.c_stack+1; i++) {
			m = mat3.multiply(this.m_stack[i],m);
			this.m_cache[i] = m;
		}

		this.valid = this.c_stack-1;

		this.result = this.m_cache[this.c_stack];

		return this.result;
	};

	Transform.prototype.pushMatrix = function() {
		this.c_stack++;
		this.m_stack[this.c_stack] = this.getIdentity();
	};

	Transform.prototype.popMatrix = function() {
		if (this.c_stack === 0) { return; }
		this.c_stack--;
	};

	var translateMatrix = Transform.prototype.getIdentity();

	Transform.prototype.translate = function(x, y) {
		translateMatrix[6] = x;
		translateMatrix[7] = y;

		mat3.multiply(translateMatrix, this.m_stack[this.c_stack]);
	};

	var scaleMatrix = Transform.prototype.getIdentity();

	Transform.prototype.scale = function(x, y) {
		scaleMatrix[0] = x;
		scaleMatrix[4] = y;

		mat3.multiply(scaleMatrix, this.m_stack[this.c_stack]);
	};

	var rotateMatrix = Transform.prototype.getIdentity();

	Transform.prototype.rotate = function(ang) {
		var sAng, cAng;

		sAng = Math.sin(-ang);
		cAng = Math.cos(-ang);

		rotateMatrix[0] = cAng;
		rotateMatrix[3] = sAng;
		rotateMatrix[1] = -sAng;
		rotateMatrix[4] = cAng;

		mat3.multiply(rotateMatrix, this.m_stack[this.c_stack]);
	};

	function init(id) {
		var chromeFrameEnabled = false;
		
		if (typeof window.ActiveXObject != "undefined") try {
			var activeX = new ActiveXObject("ChromeTab.ChromeFrame");
			if (activeX) {
				try {
					var tryChromeFrame = document.createElement("canvas");
					var gl = tryChromeFrame.getContext("webgl") || tryChromeFrame.getContext("experimental-webgl");				
					chromeFrameEnabled = (typeof(gl) !== 'undefined' && gl !== null);
				} catch (e) {}
			}
		} catch (e) {}		
	
		if (navigator.userAgent.indexOf("MSIE") < 0 || chromeFrameEnabled) {
			if (!chromeFrameEnabled && navigator.userAgent.indexOf("Opera") >= 0) try {
				new WebGL2D(document.createElement("canvas"));
			} catch  (e) { return; }

			new WebGL2D(document.getElementById(id));
		} else {
			var tryIEWebGL = document.createElement("object");
			
			tryIEWebGL.onreadystatechange = function() {
				var canvas = document.getElementById(id);
				var IEWebGL = document.createElement("object");
				
				IEWebGL.onreadystatechange = function() {
					new WebGL2D(IEWebGL);
				}
				
				canvas.parentNode.replaceChild(IEWebGL, canvas);
				
				IEWebGL.id = id;				
				IEWebGL.width = canvas.width;
				IEWebGL.height = canvas.height;	
				IEWebGL.type = "application/x-webgl";
			};
			
			tryIEWebGL.type = "application/x-webgl";
		}
	}

})();