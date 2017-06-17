﻿
//Compatibility.js
/**
 * @namespace Allows access to webRTC and other features for browsers that are
 * not conforming to the latest standard (yet). Supported Browsers are: 
 * Chrome, Opera and Firefox (soon).
 */
var compatibility = (function () {
    var lastTime = 0,

		URL = window.URL || window.webkitURL,

		requestAnimationFrame = function (callback, element) {
		    var requestAnimationFrame =
				window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				function (callback, element) {
				    var currTime = new Date().getTime();
				    var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				    var id = window.setTimeout(function () {
				        callback(currTime + timeToCall);
				    }, timeToCall);
				    lastTime = currTime + timeToCall;
				    return id;
				};

		    return requestAnimationFrame.call(window, callback, element);
		},

		getUserMedia = function (options, success, error) {
		    var getUserMedia =
				window.navigator.getUserMedia ||
				window.navigator.mozGetUserMedia ||
				window.navigator.webkitGetUserMedia ||
				function (options, success, error) {
				    error();
				};

		    return getUserMedia.call(window.navigator, options, success, error);
		};

    return {
        URL: URL,
        requestAnimationFrame: requestAnimationFrame,
        getUserMedia: getUserMedia
    };
})();

//======Smoother.js
/**
 * Double-exponential smoothing based on Wright's modification of Holt's method
 * for irregular data.
 * 
 * Copyright 2014 Martin Tschirsich
 * Released under the MIT license
 * 
 * @param {Array}  alphas        Exponential smoothing factors
 * @param {Array}  initialValues Initial values before smoothing
 * @param {Number} lookAhead     Additionally added linear trend, between 0 - 1
 */

var Smoother = function (alphas, initialValues, lookAhead) {
    "use strict";

    var lastUpdate = +new Date(),
		initialAlphas = alphas.slice(0),
		alphas = alphas.slice(0),
		a = initialValues.slice(0),
		b = initialValues.slice(0),
		numValues = initialValues.length,
		lookAhead = (typeof lookAhead !== 'undefined') ? lookAhead : 1.0;

    this.smooth = function (values) {
        var smoothedValues = [];

        // time in seconds since last update:
        var time = new Date() - lastUpdate;
        lastUpdate += time;
        time /= 1000;

        // update:
        for (var i = 0; i < numValues; ++i) {

            // Wright's modification of Holt's method for irregular data:
            alphas[i] = alphas[i] / (alphas[i] + Math.pow(1 - initialAlphas[i], time));

            var oldA = a[i];
            a[i] = alphas[i] * values[i] + (1 - alphas[i]) * (a[i] + b[i] * time);
            b[i] = alphas[i] * (a[i] - oldA) / time + (1 - alphas[i]) * b[i];

            smoothedValues[i] = a[i] + time * lookAhead * b[i];

            // Alternative approach:
            //a[i] = alphas[i] * values[i] + (1 - alphas[i]) * a[i];
            //b[i] = alphas[i] * a[i] + (1 - alphas[i]) * b[i];
            //smoothedValues[i] = 2*a[i] - 1*b[i];*/
        }

        return smoothedValues;
    };
};


//objectdetect.js
/**
 * Real-time object detector based on the Viola Jones Framework.
 * Compatible to OpenCV Haar Cascade Classifiers (stump based only).
 * 
 * Copyright (c) 2012, Martin Tschirsich
 */
var objectdetect = (function () {
    "use strict";

    var /**
		 * Converts from a 4-channel RGBA source image to a 1-channel grayscale
		 * image. Corresponds to the CV_RGB2GRAY OpenCV color space conversion.
		 * 
		 * @param {Array} src   4-channel 8-bit source image
		 * @param {Array} [dst] 1-channel 32-bit destination image
		 * 
		 * @return {Array} 1-channel 32-bit destination image
		 */
		convertRgbaToGrayscale = function (src, dst) {
		    var srcLength = src.length;
		    if (!dst) dst = new Uint32Array(srcLength >> 2);

		    for (var i = 0; i < srcLength; i += 2) {
		        dst[i >> 2] = (src[i] * 4899 + src[++i] * 9617 + src[++i] * 1868 + 8192) >> 14;
		    }
		    return dst;
		},

		/**
		 * Reduces the size of a given image by the given factor. Does NOT 
		 * perform interpolation. If interpolation is required, prefer using
		 * the drawImage() method of the <canvas> element.
		 * 
		 * @param {Array}  src       1-channel source image
		 * @param {Number} srcWidth	 Width of the source image
		 * @param {Number} srcHeight Height of the source image
		 * @param {Number} factor    Scaling down factor (> 1.0)
		 * @param {Array}  [dst]     1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		rescaleImage = function (src, srcWidth, srcHeight, factor, dst) {
		    var srcLength = srcHeight * srcWidth,
				dstWidth = ~~(srcWidth / factor),
				dstHeight = ~~(srcHeight / factor);

		    if (!dst) dst = new src.constructor(dstWidth * srcHeight);

		    for (var x = 0; x < dstWidth; ++x) {
		        var dstIndex = x;
		        for (var srcIndex = ~~(x * factor), srcEnd = srcIndex + srcLength; srcIndex < srcEnd; srcIndex += srcWidth) {
		            dst[dstIndex] = src[srcIndex];
		            dstIndex += dstWidth;
		        }
		    }

		    var dstIndex = 0;
		    for (var y = 0, yEnd = dstHeight * factor; y < yEnd; y += factor) {
		        for (var srcIndex = ~~y * dstWidth, srcEnd = srcIndex + dstWidth; srcIndex < srcEnd; ++srcIndex) {
		            dst[dstIndex] = dst[srcIndex];
		            ++dstIndex;
		        }
		    }
		    return dst;
		},

		/**
		 * Horizontally mirrors a 1-channel source image.
		 * 
		 * @param {Array}  src       1-channel source image
		 * @param {Number} srcWidth  Width of the source image
		 * @param {Number} srcHeight Height of the source image
		 * @param {Array} [dst]      1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		mirrorImage = function (src, srcWidth, srcHeight, dst) {
		    if (!dst) dst = new src.constructor(srcWidth * srcHeight);

		    var index = 0;
		    for (var y = 0; y < srcHeight; ++y) {
		        for (var x = (srcWidth >> 1) ; x >= 0; --x) {
		            var swap = src[index + x];
		            dst[index + x] = src[index + srcWidth - 1 - x];
		            dst[index + srcWidth - 1 - x] = swap;
		        }
		        index += srcWidth;
		    }
		    return dst;
		},

		/**
		 * Computes the gradient magnitude using a sobel filter after
		 * applying gaussian smoothing (5x5 filter size). Useful for canny
		 * pruning.
		 * 
		 * @param {Array}  src      1-channel source image
		 * @param {Number} srcWidth Width of the source image
		 * @param {Number} srcWidth Height of the source image
		 * @param {Array}  [dst]    1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		computeCanny = function (src, srcWidth, srcHeight, dst) {
		    var srcLength = srcWidth * srcHeight;
		    if (!dst) dst = new src.constructor(srcLength);
		    var buffer1 = dst === src ? new src.constructor(srcLength) : dst;
		    var buffer2 = new src.constructor(srcLength);

		    // Gaussian filter with size=5, sigma=sqrt(2) horizontal pass:
		    for (var x = 2; x < srcWidth - 2; ++x) {
		        var index = x;
		        for (var y = 0; y < srcHeight; ++y) {
		            buffer1[index] =
						0.1117 * src[index - 2] +
						0.2365 * src[index - 1] +
						0.3036 * src[index] +
						0.2365 * src[index + 1] +
						0.1117 * src[index + 2];
		            index += srcWidth;
		        }
		    }

		    // Gaussian filter with size=5, sigma=sqrt(2) vertical pass:
		    for (var x = 0; x < srcWidth; ++x) {
		        var index = x + srcWidth;
		        for (var y = 2; y < srcHeight - 2; ++y) {
		            index += srcWidth;
		            buffer2[index] =
						0.1117 * buffer1[index - srcWidth - srcWidth] +
						0.2365 * buffer1[index - srcWidth] +
						0.3036 * buffer1[index] +
						0.2365 * buffer1[index + srcWidth] +
						0.1117 * buffer1[index + srcWidth + srcWidth];
		        }
		    }

		    // Compute gradient:
		    var abs = Math.abs;
		    for (var x = 2; x < srcWidth - 2; ++x) {
		        var index = x + srcWidth;
		        for (var y = 2; y < srcHeight - 2; ++y) {
		            index += srcWidth;

		            dst[index] =
						abs(-buffer2[index - 1 - srcWidth]
							+ buffer2[index + 1 - srcWidth]
							- 2 * buffer2[index - 1]
							+ 2 * buffer2[index + 1]
							- buffer2[index - 1 + srcWidth]
							+ buffer2[index + 1 + srcWidth]) +

						abs(buffer2[index - 1 - srcWidth]
							+ 2 * buffer2[index - srcWidth]
							+ buffer2[index + 1 - srcWidth]
							- buffer2[index - 1 + srcWidth]
							- 2 * buffer2[index + srcWidth]
							- buffer2[index + 1 + srcWidth]);
		        }
		    }
		    return dst;
		},

		/**
		 * Computes the integral image of a 1-channel image. Arithmetic
		 * overflow may occur if the integral exceeds the limits for the
		 * destination image values ([0, 2^32-1] for an unsigned 32-bit image).
		 * The integral image is 1 pixel wider both in vertical and horizontal
		 * dimension compared to the source image.
		 * 
		 * SAT = Summed Area Table.
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeSat = function (src, srcWidth, srcHeight, dst) {
		    var dstWidth = srcWidth + 1;

		    if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);

		    for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
		        dst[i] = 0;

		    for (var x = 1; x <= srcWidth; ++x) {
		        var column_sum = 0;
		        var index = x;
		        dst[x] = 0;

		        for (var y = 1; y <= srcHeight; ++y) {
		            column_sum += src[index - y];
		            index += dstWidth;
		            dst[index] = dst[index - 1] + column_sum;
		        }
		    }
		    return dst;
		},

		/**
		 * Computes the squared integral image of a 1-channel image.
		 * @see computeSat()
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeSquaredSat = function (src, srcWidth, srcHeight, dst) {
		    var dstWidth = srcWidth + 1;

		    if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);

		    for (var i = srcHeight * dstWidth; i >= 0; i -= dstWidth)
		        dst[i] = 0;

		    for (var x = 1; x <= srcWidth; ++x) {
		        var column_sum = 0;
		        var index = x;
		        dst[x] = 0;
		        for (var y = 1; y <= srcHeight; ++y) {
		            var val = src[index - y];
		            column_sum += val * val;
		            index += dstWidth;
		            dst[index] = dst[index - 1] + column_sum;
		        }
		    }
		    return dst;
		},

		/**
		 * Computes the rotated / tilted integral image of a 1-channel image.
		 * @see computeSat()
		 * 
		 * @param {Array}       src       1-channel source image
		 * @param {Number}      srcWidth  Width of the source image
		 * @param {Number}      srcHeight Height of the source image
		 * @param {Uint32Array} [dst]     1-channel destination image
		 * 
		 * @return {Uint32Array} 1-channel destination image
		 */
		computeRsat = function (src, srcWidth, srcHeight, dst) {
		    var dstWidth = srcWidth + 1,
				srcHeightTimesDstWidth = srcHeight * dstWidth;

		    if (!dst) dst = new Uint32Array(srcWidth * srcHeight + dstWidth + srcHeight);

		    for (var i = srcHeightTimesDstWidth; i >= 0; i -= dstWidth)
		        dst[i] = 0;

		    for (var i = 0; i < dstWidth; ++i)
		        dst[i] = 0;

		    var index = 0;
		    for (var y = 0; y < srcHeight; ++y) {
		        for (var x = 0; x < srcWidth; ++x) {
		            dst[index + dstWidth + 1] = src[index - y] + dst[index];
		            ++index;
		        }
		        dst[index + dstWidth] += dst[index];
		        index++;
		    }

		    for (var x = srcWidth - 1; x > 0; --x) {
		        var index = x + srcHeightTimesDstWidth;
		        for (var y = srcHeight; y > 0; --y) {
		            index -= dstWidth;
		            dst[index + dstWidth] += dst[index] + dst[index + 1];
		        }
		    }

		    return dst;
		},

		/**
		 * Equalizes the histogram of an unsigned 1-channel image with integer 
		 * values in [0, 255]. Corresponds to the equalizeHist OpenCV function.
		 * 
		 * @param {Array}  src   1-channel integer source image
		 * @param {Number} step  Sampling stepsize, increase for performance
		 * @param {Array}  [dst] 1-channel destination image
		 * 
		 * @return {Array} 1-channel destination image
		 */
		equalizeHistogram = function (src, step, dst) {
		    var srcLength = src.length;
		    if (!dst) dst = src;
		    if (!step) step = 5;

		    // Compute histogram and histogram sum:
		    var hist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			            0, 0, 0, 0];

		    for (var i = 0; i < srcLength; i += step) {
		        ++hist[src[i]];
		    }

		    // Compute integral histogram:
		    var norm = 255 * step / srcLength,
				prev = 0;
		    for (var i = 0; i < 256; ++i) {
		        var h = hist[i];
		        prev = h += prev;
		        hist[i] = h * norm; // For non-integer src: ~~(h * norm + 0.5);
		    }

		    // Equalize image:
		    for (var i = 0; i < srcLength; ++i) {
		        dst[i] = hist[src[i]];
		    }
		    return dst;
		},

		/**
		 * Horizontally mirrors a cascase classifier. Useful to detect mirrored
		 * objects such as opposite hands.
		 * 
		 * @param {Array} dst Cascade classifier
		 * 
		 * @return {Array} Mirrored cascade classifier
		 */
		mirrorClassifier = function (src, dst) {
		    if (!dst) dst = new src.constructor(src);
		    var windowWidth = src[0];

		    for (var i = 1, iEnd = src.length - 1; i < iEnd;) {
		        ++i;
		        for (var j = 0, jEnd = src[++i]; j < jEnd; ++j) {
		            if (src[++i]) {
		                // Simple classifier is tilted:
		                for (var kEnd = i + src[++i] * 5; i < kEnd;) {
		                    dst[i + 1] = windowWidth - src[i + 1];
		                    var width = src[i + 3];
		                    dst[i + 3] = src[i + 4];
		                    dst[i + 4] = width;
		                    i += 5;
		                }
		            } else {
		                // Simple classifier is not tilted:
		                for (var kEnd = i + src[++i] * 5; i < kEnd;) {
		                    dst[i + 1] = windowWidth - src[i + 1] - src[i + 3];
		                    i += 5;
		                }
		            }
		            i += 3;
		        }
		    }
		    return dst;
		},

		/**
		 * Compiles a cascade classifier to be applicable to images
		 * of given dimensions. Speeds-up the actual detection process later on.
		 * 
		 * @param {Array}        src    Cascade classifier
		 * @param {Number}       width  Width of the source image
		 * @param {Float32Array} [dst]  Compiled cascade classifier
		 * 
		 * @return {Float32Array} Compiled cascade classifier
		 */
		compileClassifier = function (src, width, scale, dst) {
		    width += 1;
		    if (!dst) dst = new Float32Array(src.length);
		    var dstUint32 = new Uint32Array(dst.buffer);

		    dstUint32[0] = src[0];
		    dstUint32[1] = src[1];
		    var dstIndex = 1;
		    for (var srcIndex = 1, iEnd = src.length - 1; srcIndex < iEnd;) {
		        dst[++dstIndex] = src[++srcIndex];

		        var numComplexClassifiers = dstUint32[++dstIndex] = src[++srcIndex];
		        for (var j = 0, jEnd = numComplexClassifiers; j < jEnd; ++j) {

		            var tilted = dst[++dstIndex] = src[++srcIndex];
		            var numFeaturesTimes3 = dstUint32[++dstIndex] = src[++srcIndex] * 3;
		            if (tilted) {
		                for (var kEnd = dstIndex + numFeaturesTimes3; dstIndex < kEnd;) {
		                    dstUint32[++dstIndex] = src[++srcIndex] + src[++srcIndex] * width;
		                    dstUint32[++dstIndex] = src[++srcIndex] * (width + 1) + ((src[++srcIndex] * (width - 1)) << 16);
		                    dst[++dstIndex] = src[++srcIndex];
		                }
		            } else {
		                for (var kEnd = dstIndex + numFeaturesTimes3; dstIndex < kEnd;) {
		                    dstUint32[++dstIndex] = src[++srcIndex] + src[++srcIndex] * width;
		                    dstUint32[++dstIndex] = src[++srcIndex] + ((src[++srcIndex] * width) << 16);
		                    dst[++dstIndex] = src[++srcIndex];
		                }
		            }

		            var inverseClassifierThreshold = 1 / src[++srcIndex];
		            for (var k = 0; k < numFeaturesTimes3;) {
		                dst[dstIndex - k] *= inverseClassifierThreshold;
		                k += 3;
		            }

		            if (inverseClassifierThreshold < 0) {
		                dst[dstIndex + 2] = src[++srcIndex];
		                dst[dstIndex + 1] = src[++srcIndex];
		                dstIndex += 2;
		            } else {
		                dst[++dstIndex] = src[++srcIndex];
		                dst[++dstIndex] = src[++srcIndex];
		            }
		        }
		    }
		    return dst.subarray(0, dstIndex + 1);
		},

		/**
		 * Evaluates a compiled cascade classifier. Sliding window approach.
		 * 
		 * @param {Uint32Array}  sat        SAT of the source image
		 * @param {Uint32Array}  rsat       Rotated SAT of the source image
		 * @param {Uint32Array}  ssat       Squared SAT of the source image
		 * @param {Uint32Array}  [cannySat] SAT of the canny source image
		 * @param {Number}       width      Width of the source image
		 * @param {Number}       height     Height of the source image
		 * @param {Number}       step       Stepsize, increase for performance
		 * @param {Float32Array} classifier Compiled cascade classifier
		 * 
		 * @return {Array} Rectangles representing detected objects
		 */
		detect = function (sat, rsat, ssat, cannySat, width, height, step, classifier) {
		    width += 1;
		    height += 1;

		    var classifierUint32 = new Uint32Array(classifier.buffer),
				windowWidth = classifierUint32[0],
				windowHeight = classifierUint32[1],
				windowHeightTimesWidth = windowHeight * width,
				area = windowWidth * windowHeight,
				inverseArea = 1 / area,
				widthTimesStep = width * step,
				rects = [];

		    for (var x = 0; x + windowWidth < width; x += step) {
		        var satIndex = x;
		        for (var y = 0; y + windowHeight < height; y += step) {
		            var satIndex1 = satIndex + windowWidth,
						satIndex2 = satIndex + windowHeightTimesWidth,
						satIndex3 = satIndex2 + windowWidth,
						canny = false;

		            // Canny test:
		            if (cannySat) {
		                var edgesDensity = (cannySat[satIndex] -
											cannySat[satIndex1] -
											cannySat[satIndex2] +
											cannySat[satIndex3]) * inverseArea;
		                if (edgesDensity < 60 || edgesDensity > 200) {
		                    canny = true;
		                    satIndex += widthTimesStep;
		                    continue;
		                }
		            }

		            // Normalize mean and variance of window area:
		            var mean = (sat[satIndex] -
							    sat[satIndex1] -
						        sat[satIndex2] +
						        sat[satIndex3]),

						variance = (ssat[satIndex] -
						            ssat[satIndex1] -
						            ssat[satIndex2] +
						            ssat[satIndex3]) * area - mean * mean,

						std = variance > 1 ? Math.sqrt(variance) : 1,
						found = true;

		            // Evaluate cascade classifier aka 'stages':
		            for (var i = 1, iEnd = classifier.length - 1; i < iEnd;) {
		                var complexClassifierThreshold = classifier[++i];
		                // Evaluate complex classifiers aka 'trees':
		                var complexClassifierSum = 0;
		                for (var j = 0, jEnd = classifierUint32[++i]; j < jEnd; ++j) {

		                    // Evaluate simple classifiers aka 'nodes':
		                    var simpleClassifierSum = 0;

		                    if (classifierUint32[++i]) {
		                        // Simple classifier is tilted:
		                        for (var kEnd = i + classifierUint32[++i]; i < kEnd;) {
		                            var f1 = satIndex + classifierUint32[++i],
										packed = classifierUint32[++i],
										f2 = f1 + (packed & 0xFFFF),
										f3 = f1 + (packed >> 16 & 0xFFFF);

		                            simpleClassifierSum += classifier[++i] *
										(rsat[f1] - rsat[f2] - rsat[f3] + rsat[f2 + f3 - f1]);
		                        }
		                    } else {
		                        // Simple classifier is not tilted:
		                        for (var kEnd = i + classifierUint32[++i]; i < kEnd;) {
		                            var f1 = satIndex + classifierUint32[++i],
										packed = classifierUint32[++i],
										f2 = f1 + (packed & 0xFFFF),
										f3 = f1 + (packed >> 16 & 0xFFFF);

		                            simpleClassifierSum += classifier[++i] *
										(sat[f1] - sat[f2] - sat[f3] + sat[f2 + f3 - f1]);
		                        }
		                    }
		                    complexClassifierSum += classifier[i + (simpleClassifierSum > std ? 2 : 1)];
		                    i += 2;
		                }
		                if (complexClassifierSum < complexClassifierThreshold) {
		                    found = false;
		                    break;
		                }
		            }
		            if (found) rects.push([x, y, windowWidth, windowHeight]);
		            satIndex += widthTimesStep;
		        }
		    }
		    return rects;
		},

		/**
		 * Groups rectangles together using a rectilinear distance metric. For
		 * each group of related rectangles, a representative mean rectangle
		 * is returned.
		 * 
		 * @param {Array}  rects        Rectangles (Arrays of 4 floats)
		 * @param {Number} minNeighbors Minimum neighbors for returned groups
		 * @param {Number} confluence	Neighbor distance threshold factor
		 * @return {Array} Mean rectangles (Arrays of 4 floats)
		 */
		groupRectangles = function (rects, minNeighbors, confluence) {
		    var rectsLength = rects.length;
		    if (!confluence) confluence = 0.25;

		    // Partition rects into similarity classes:
		    var numClasses = 0;
		    var labels = new Array(rectsLength);
		    for (var i = 0; i < rectsLength; ++i) {
		        labels[i] = 0;
		    }

		    var abs = Math.abs, min = Math.min;
		    for (var i = 0; i < rectsLength; ++i) {
		        var found = false;
		        for (var j = 0; j < i; ++j) {

		            // Determine similarity:
		            var rect1 = rects[i];
		            var rect2 = rects[j];
		            var delta = confluence * (min(rect1[2], rect2[2]) + min(rect1[3], rect2[3]));
		            if (abs(rect1[0] - rect2[0]) <= delta &&
			        	abs(rect1[1] - rect2[1]) <= delta &&
			        	abs(rect1[0] + rect1[2] - rect2[0] - rect2[2]) <= delta &&
			        	abs(rect1[1] + rect1[3] - rect2[1] - rect2[3]) <= delta) {

		                labels[i] = labels[j];
		                found = true;
		                break;
		            }
		        }
		        if (!found) {
		            labels[i] = numClasses++;
		        }
		    }

		    // Compute average rectangle (group) for each cluster:
		    var groups = new Array(numClasses);

		    for (var i = 0; i < numClasses; ++i) {
		        groups[i] = [0, 0, 0, 0, 0];
		    }

		    for (var i = 0; i < rectsLength; ++i) {
		        var rect = rects[i],
					group = groups[labels[i]];
		        group[0] += rect[0];
		        group[1] += rect[1];
		        group[2] += rect[2];
		        group[3] += rect[3];
		        ++group[4];
		    }

		    for (var i = 0; i < numClasses; ++i) {
		        var numNeighbors = groups[i][4];
		        if (numNeighbors >= minNeighbors) {
		            var group = groups[i];
		            numNeighbors = 1 / numNeighbors;
		            group[0] *= numNeighbors;
		            group[1] *= numNeighbors;
		            group[2] *= numNeighbors;
		            group[3] *= numNeighbors;
		        } else groups.splice(i, 1);
		    }

		    // Filter out small rectangles inside larger rectangles:
		    var filteredGroups = [];
		    for (var i = 0; i < numClasses; ++i) {
		        var r1 = groups[i];

		        for (var j = i + 1; j < numClasses; ++j) {
		            var r2 = groups[j];

		            var dx = r2[2] * confluence;// * 0.2;
		            var dy = r2[3] * confluence;// * 0.2;

		            // Not antisymmetric, must check both r1 > r2 and r2 > r1:
		            if ((r1[0] >= r2[0] - dx &&
		                 r1[1] >= r2[1] - dy &&
		                 r1[0] + r1[2] <= r2[0] + r2[2] + dx &&
		                 r1[1] + r1[3] <= r2[1] + r2[3] + dy) ||
		                (r2[0] >= r1[0] - dx &&
		                 r2[1] >= r1[1] - dy &&
		                 r2[0] + r2[2] <= r1[0] + r1[2] + dx &&
		                 r2[1] + r2[3] <= r1[1] + r1[3] + dy)) {
		                break;
		            }
		        }

		        if (j === numClasses) {
		            filteredGroups.push(r1);
		        }
		    }
		    return filteredGroups;
		};

    var detector = (function () {

        /**
		 * Creates a new detector - basically a convenient wrapper class around
		 * the js-objectdetect functions and hides away the technical details
		 * of multi-scale object detection on image, video or canvas elements.
		 * 
		 * @param width       Width of the detector
		 * @param height      Height of the detector
		 * @param scaleFactor Scaling factor for multi-scale detection
		 * @param classifier  Compiled cascade classifier
		 */
        function detector(width, height, scaleFactor, classifier) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
            this.context = this.canvas.getContext('2d');
            this.tilted = classifier.tilted;
            this.scaleFactor = scaleFactor;
            this.numScales = ~~(Math.log(Math.min(width / classifier[0], height / classifier[1])) / Math.log(scaleFactor));
            this.scaledGray = new Uint32Array(width * height);
            this.compiledClassifiers = [];
            var scale = 1;
            for (var i = 0; i < this.numScales; ++i) {
                var scaledWidth = ~~(width / scale);
                this.compiledClassifiers[i] = objectdetect.compileClassifier(classifier, scaledWidth);
                scale *= scaleFactor;
            }
        }

        /**
		 * Multi-scale object detection on image, video or canvas elements. 
		 * 
		 * @param image          HTML image, video or canvas element
		 * @param [group]        Detection results will be grouped by proximity
		 * @param [stepSize]     Increase for performance
		 * @param [roi]          Region of interest, i.e. search window
		 * 
		 * @return Grouped rectangles
		 */
        detector.prototype.detect = function (image, group, stepSize, roi, canny) {
            if (stepSize === undefined) stepSize = 1;
            if (group === undefined) group = 1;

            var width = this.canvas.width;
            var height = this.canvas.height;

            if (roi)
                this.context.drawImage(image, roi[0], roi[1], roi[2], roi[3], 0, 0, width, height);
            else
                this.context.drawImage(image, 0, 0, width, height);
            var imageData = this.context.getImageData(0, 0, width, height).data;
            this.gray = objectdetect.convertRgbaToGrayscale(imageData, this.gray);

            var rects = [];
            var scale = 1;
            for (var i = 0; i < this.numScales; ++i) {
                var scaledWidth = ~~(width / scale);
                var scaledHeight = ~~(height / scale);

                if (scale === 1) {
                    this.scaledGray.set(this.gray);
                } else {
                    this.scaledGray = objectdetect.rescaleImage(this.gray, width, height, scale, this.scaledGray);
                }

                if (canny) {
                    this.canny = objectdetect.computeCanny(this.scaledGray, scaledWidth, scaledHeight, this.canny);
                    this.cannySat = objectdetect.computeSat(this.canny, scaledWidth, scaledHeight, this.cannySat);
                }

                this.sat = objectdetect.computeSat(this.scaledGray, scaledWidth, scaledHeight, this.sat);
                this.ssat = objectdetect.computeSquaredSat(this.scaledGray, scaledWidth, scaledHeight, this.ssat);
                if (this.tilted) this.rsat = objectdetect.computeRsat(this.scaledGray, scaledWidth, scaledHeight, this.rsat);

                var newRects = objectdetect.detect(this.sat, this.rsat, this.ssat, this.cannySat, scaledWidth, scaledHeight, stepSize, this.compiledClassifiers[i]);
                for (var j = newRects.length - 1; j >= 0; --j) {
                    var newRect = newRects[j];
                    newRect[0] *= scale;
                    newRect[1] *= scale;
                    newRect[2] *= scale;
                    newRect[3] *= scale;
                }
                rects = rects.concat(newRects);

                scale *= this.scaleFactor;
            }
            return (group ? objectdetect.groupRectangles(rects, group) : rects).sort(function (r1, r2) { return r2[4] - r1[4]; });
        };

        return detector;
    })();

    return {
        convertRgbaToGrayscale: convertRgbaToGrayscale,
        rescaleImage: rescaleImage,
        mirrorImage: mirrorImage,
        computeCanny: computeCanny,
        equalizeHistogram: equalizeHistogram,
        computeSat: computeSat,
        computeRsat: computeRsat,
        computeSquaredSat: computeSquaredSat,
        mirrorClassifier: mirrorClassifier,
        compileClassifier: compileClassifier,
        detect: detect,
        groupRectangles: groupRectangles,
        detector: detector
    };
})();

//handfist.js
(function (module) {
    "use strict";

    var classifier = [24, 24, -0.3911409080028534, 2, 0, 2, 3, 3, 9, 16, -1., 3, 7, 9, 8, 2., -0.0223442204296589, 0.7737345099449158, -0.9436557292938232, 0, 2, 0, 9, 12, 5, -1., 6, 9, 6, 5, 2., -9.3714958056807518e-003, 0.5525149106979370, -0.9004204869270325, -0.8027257919311523, 5, 0, 3, 12, 14, 12, 10, -1., 12, 14, 6, 5, 2., 18, 19, 6, 5, 2., 0.0127444602549076, -0.7241874933242798, 0.5557708144187927, 0, 2, 2, 4, 16, 8, -1., 2, 8, 16, 4, 2., -0.0203973893076181, 0.3255875110626221, -0.9134256243705750, 0, 2, 9, 6, 15, 14, -1., 9, 13, 15, 7, 2., 1.5015050303190947e-003, -0.8422530293464661, 0.2950277030467987, 0, 2, 0, 10, 10, 5, -1., 5, 10, 5, 5, 2., -9.5540005713701248e-003, 0.2949278056621552, -0.8186870813369751, 1, 2, 8, 0, 16, 6, -1., 8, 0, 16, 3, 2., -9.0454015880823135e-003, -0.9253956079483032, 0.2449316978454590, -0.6695849895477295, 4, 1, 2, 11, 9, 9, 6, -1., 14, 12, 3, 6, 3., 0.0339135192334652, -0.6010565757751465, 0.5952491760253906, 0, 2, 15, 1, 8, 10, -1., 15, 6, 8, 5, 2., -6.3976310193538666e-003, 0.2902083992958069, -0.9008722901344299, 0, 2, 12, 23, 12, 1, -1., 18, 23, 6, 1, 2., 3.5964029375463724e-003, -0.6108912825584412, 0.3585815131664276, 0, 2, 0, 8, 16, 11, -1., 8, 8, 8, 11, 2., 3.1002631294541061e-004, 0.2521544992923737, -0.9231098890304565, -0.9460288882255554, 4, 0, 2, 12, 22, 12, 2, -1., 18, 22, 6, 2, 2., 8.9982077479362488e-003, -0.6216139197349548, 0.5311666131019592, 1, 2, 6, 7, 10, 5, -1., 6, 7, 5, 5, 2., 5.8961678296327591e-003, 0.3589088022708893, -0.8741096854209900, 0, 2, 10, 8, 3, 2, -1., 10, 9, 3, 1, 2., -7.3489747592248023e-005, 0.2021690011024475, -0.8340616226196289, 1, 2, 15, 15, 3, 4, -1., 15, 15, 3, 2, 2., -1.3183970004320145e-003, -0.8218436241149902, 0.2309758067131043, -1.0588489770889282, 7, 0, 3, 4, 18, 20, 6, -1., 4, 18, 10, 3, 2., 14, 21, 10, 3, 2., 5.8955969288945198e-003, -0.7554979920387268, 0.3239434063434601, 0, 3, 3, 1, 20, 14, -1., 3, 1, 10, 7, 2., 13, 8, 10, 7, 2., 8.6170788854360580e-003, -0.7028874754905701, 0.2782224118709564, 0, 2, 2, 11, 3, 9, -1., 3, 14, 1, 3, 9., -1.5837070532143116e-003, -0.7751926779747009, 0.2773326933383942, 0, 3, 0, 4, 12, 20, -1., 0, 4, 6, 10, 2., 6, 14, 6, 10, 2., 7.9292394220829010e-003, -0.7723438143730164, 0.2167312055826187, 1, 2, 16, 15, 6, 2, -1., 16, 15, 6, 1, 2., -1.4443190302699804e-003, -0.8843228220939636, 0.2078661024570465, 0, 2, 11, 8, 7, 2, -1., 11, 9, 7, 1, 2., -4.8251380212605000e-004, 0.2337501049041748, -0.6776664853096008, 0, 2, 20, 15, 4, 6, -1., 22, 15, 2, 6, 2., 8.0077340826392174e-003, -0.3731102049350739, 0.5163818001747131, -0.7966647148132324, 5, 0, 2, 14, 19, 1, 2, -1., 14, 20, 1, 1, 2., -5.8145709772361442e-005, 0.3404448032379150, -0.6792302131652832, 0, 2, 0, 6, 2, 7, -1., 1, 6, 1, 7, 2., -1.1419489746913314e-003, 0.3598371148109436, -0.5890597105026245, 1, 2, 8, 0, 10, 2, -1., 8, 0, 5, 2, 2., 5.8654937893152237e-003, -0.9622359871864319, 0.1721540987491608, 0, 2, 5, 8, 16, 7, -1., 13, 8, 8, 7, 2., 1.1028599692508578e-004, -0.7706093192100525, 0.2389315962791443, 0, 2, 2, 9, 14, 12, -1., 9, 9, 7, 12, 2., 0.0145609602332115, 0.1552716046571732, -0.8984915018081665, -1.0856239795684814, 9, 0, 3, 2, 11, 6, 10, -1., 2, 11, 3, 5, 2., 5, 16, 3, 5, 2., 3.9159432053565979e-003, -0.7370954751968384, 0.2886646091938019, 0, 2, 0, 3, 4, 9, -1., 2, 3, 2, 9, 2., -4.6402178704738617e-003, 0.3129867017269135, -0.5601897239685059, 0, 2, 7, 10, 10, 8, -1., 12, 10, 5, 8, 2., -4.2656981386244297e-003, -0.8286197781562805, 0.2132489979267120, 0, 3, 8, 16, 16, 8, -1., 8, 16, 8, 4, 2., 16, 20, 8, 4, 2., 7.9925684258341789e-003, -0.6752548217773438, 0.2340082973241806, 1, 2, 4, 13, 6, 3, -1., 6, 15, 2, 3, 3., -6.2725958414375782e-003, -0.7839264273643494, 0.2019792944192886, 0, 2, 13, 3, 11, 18, -1., 13, 12, 11, 9, 2., -0.0288890209048986, -0.7889788150787354, 0.1651563942432404, 0, 2, 10, 7, 5, 4, -1., 10, 9, 5, 2, 2., -1.5122259501367807e-003, 0.1971655040979385, -0.7596625089645386, 0, 2, 11, 17, 6, 3, -1., 13, 18, 2, 1, 9., 4.3620187789201736e-003, 0.1344974040985107, -0.9309347271919251, 0, 2, 12, 7, 12, 17, -1., 15, 7, 6, 17, 2., -3.2192119397222996e-003, 0.2437663972377777, -0.6044244170188904, -0.8849025964736939, 8, 0, 2, 14, 18, 1, 2, -1., 14, 19, 1, 1, 2., -4.3883759644813836e-005, 0.3130159080028534, -0.6793813705444336, 0, 3, 3, 11, 6, 12, -1., 3, 11, 3, 6, 2., 6, 17, 3, 6, 2., 6.2022951897233725e-004, -0.8423554897308350, 0.1801322996616364, 0, 2, 22, 13, 2, 7, -1., 23, 13, 1, 7, 2., 1.0972339659929276e-003, -0.4771775007247925, 0.3450973927974701, 1, 2, 16, 15, 1, 2, -1., 16, 15, 1, 1, 2., -2.6349889230914414e-004, -0.7629253864288330, 0.2153723984956741, 0, 2, 0, 5, 22, 18, -1., 0, 14, 22, 9, 2., -0.0542980991303921, -0.8849576711654663, 0.1730009019374847, 0, 2, 13, 19, 3, 3, -1., 14, 20, 1, 1, 9., -2.1721520461142063e-003, -0.8367894887924194, 0.1638997048139572, 0, 2, 15, 0, 5, 2, -1., 15, 1, 5, 1, 2., -1.6347350319847465e-003, 0.3731253147125244, -0.4079189002513886, 1, 2, 5, 15, 4, 5, -1., 5, 15, 2, 5, 2., -2.9642079025506973e-003, -0.7973154187202454, 0.1886135041713715, -1.0250910520553589, 10, 0, 2, 12, 16, 2, 8, -1., 12, 20, 2, 4, 2., -2.6686030905693769e-003, 0.2950133979320526, -0.6534382104873657, 0, 2, 0, 18, 2, 4, -1., 1, 18, 1, 4, 2., -7.9764809925109148e-004, 0.3938421010971069, -0.4435322880744934, 1, 2, 8, 3, 12, 4, -1., 8, 3, 12, 2, 2., -5.1704752258956432e-003, -0.7686781883239746, 0.2110860049724579, 1, 2, 6, 17, 3, 2, -1., 7, 18, 1, 2, 3., -1.5294969780370593e-003, -0.8944628238677979, 0.1583137959241867, 0, 2, 1, 0, 10, 6, -1., 6, 0, 5, 6, 2., -6.3780639320611954e-003, 0.3393965959548950, -0.4529472887516022, 0, 2, 12, 9, 3, 2, -1., 12, 10, 3, 1, 2., -2.6243639877066016e-004, 0.2850841879844666, -0.4983885884284973, 1, 2, 11, 1, 12, 11, -1., 11, 1, 6, 11, 2., 0.0361888185143471, 0.2132015973329544, -0.7394319772720337, 0, 2, 21, 13, 2, 10, -1., 21, 18, 2, 5, 2., 7.7682351693511009e-003, -0.4052247107028961, 0.4112299978733063, 1, 2, 15, 16, 1, 2, -1., 15, 16, 1, 1, 2., -2.3738530580885708e-004, -0.7753518819808960, 0.1911296993494034, 0, 3, 0, 11, 8, 8, -1., 0, 11, 4, 4, 2., 4, 15, 4, 4, 2., 4.2231627739965916e-003, -0.7229338884353638, 0.1739158928394318, -0.9740471243858337, 8, 0, 2, 11, 11, 7, 6, -1., 11, 13, 7, 2, 3., 2.9137390665709972e-003, -0.5349493026733398, 0.3337337076663971, 0, 2, 12, 17, 3, 3, -1., 13, 18, 1, 1, 9., -1.6270120395347476e-003, -0.8804692029953003, 0.1722342073917389, 0, 2, 0, 9, 2, 2, -1., 1, 9, 1, 2, 2., -2.9037619242444634e-004, 0.2734786868095398, -0.5733091235160828, 0, 2, 13, 17, 1, 2, -1., 13, 18, 1, 1, 2., -1.4552129869116470e-005, 0.2491019070148468, -0.5995762944221497, 0, 2, 7, 0, 17, 18, -1., 7, 9, 17, 9, 2., 0.0141834802925587, 0.1507173925638199, -0.8961830139160156, 1, 2, 8, 11, 8, 2, -1., 8, 11, 8, 1, 2., -5.8600129705155268e-005, 0.1771630048751831, -0.7106314897537231, 0, 2, 18, 17, 6, 7, -1., 21, 17, 3, 7, 2., 7.3492531664669514e-003, -0.5106546878814697, 0.2574213147163391, 0, 2, 2, 19, 8, 1, -1., 6, 19, 4, 1, 2., -1.7738100141286850e-003, -0.8705360293388367, 0.1460683941841126, -1.4024209976196289, 11, 0, 3, 12, 10, 10, 6, -1., 12, 10, 5, 3, 2., 17, 13, 5, 3, 2., -8.5521116852760315e-003, 0.3413020968437195, -0.4556924998760223, 0, 3, 5, 20, 18, 4, -1., 5, 20, 9, 2, 2., 14, 22, 9, 2, 2., 2.9570560436695814e-003, -0.5616099834442139, 0.2246744036674500, 0, 2, 1, 10, 22, 5, -1., 12, 10, 11, 5, 2., -0.0195402801036835, -0.8423789739608765, 0.1363316029310226, 1, 2, 1, 11, 12, 1, -1., 1, 11, 6, 1, 2., -3.2073149923235178e-003, -0.7569847702980042, 0.1883326023817062, 0, 2, 12, 0, 12, 24, -1., 12, 6, 12, 12, 2., -8.4488727152347565e-003, 0.1382011026144028, -0.8026102185249329, 0, 2, 4, 15, 5, 6, -1., 4, 17, 5, 2, 3., 1.1350389831932262e-004, -0.7027189135551453, 0.1435786038637161, 1, 2, 12, 2, 6, 4, -1., 14, 4, 2, 4, 3., -5.8187649119645357e-004, -0.4507982134819031, 0.2510882019996643, 0, 2, 0, 7, 2, 17, -1., 1, 7, 1, 17, 2., -0.0161978900432587, 0.6447368860244751, -0.2079977989196777, 0, 2, 13, 15, 3, 9, -1., 14, 15, 1, 9, 3., 6.6894508199766278e-004, 0.1998561024665833, -0.7483944892883301, 0, 2, 13, 18, 3, 3, -1., 14, 19, 1, 1, 9., -1.8372290069237351e-003, -0.8788912892341614, 0.1146014034748077, 0, 2, 17, 17, 1, 2, -1., 17, 18, 1, 1, 2., -4.3397278204793110e-005, 0.2129840999841690, -0.5028128027915955, -1.1141099929809570, 11, 0, 3, 10, 11, 4, 12, -1., 10, 11, 2, 6, 2., 12, 17, 2, 6, 2., -2.0713880658149719e-003, 0.2486661970615387, -0.5756726861000061, 0, 2, 12, 23, 12, 1, -1., 18, 23, 6, 1, 2., 3.6768750287592411e-003, -0.5755078196525574, 0.2280506044626236, 1, 2, 13, 10, 3, 4, -1., 13, 10, 3, 2, 2., -3.0887479078955948e-004, 0.2362288981676102, -0.6454687118530273, 0, 3, 0, 0, 24, 24, -1., 0, 0, 12, 12, 2., 12, 12, 12, 12, 2., -0.0257820300757885, -0.7496209144592285, 0.1617882996797562, 0, 2, 2, 10, 2, 6, -1., 2, 13, 2, 3, 2., -1.2850989587605000e-003, -0.7813286781311035, 0.1440877020359039, 0, 2, 0, 11, 2, 6, -1., 0, 14, 2, 3, 2., 3.3493789378553629e-003, 0.1375873982906342, -0.7505543231964111, 0, 2, 0, 1, 24, 1, -1., 8, 1, 8, 1, 3., -2.6788329705595970e-003, 0.2596372067928314, -0.4255296885967255, 0, 2, 13, 7, 4, 2, -1., 13, 8, 4, 1, 2., -2.8834199838456698e-005, 0.1635348945856094, -0.7050843238830566, 0, 2, 0, 13, 3, 10, -1., 1, 13, 1, 10, 3., -1.6196980141103268e-003, 0.3419960141181946, -0.3415850102901459, 0, 2, 1, 10, 10, 10, -1., 6, 10, 5, 10, 2., 1.0517919436097145e-003, 0.1479195058345795, -0.7929052114486694, 1, 2, 9, 0, 4, 6, -1., 9, 0, 4, 3, 2., -2.4886541068553925e-003, -0.8937227129936218, 0.1043419018387795, -1.0776710510253906, 10, 0, 2, 16, 18, 1, 2, -1., 16, 19, 1, 1, 2., -5.7590808864915743e-005, 0.2734906971454620, -0.6426038742065430, 0, 2, 21, 14, 2, 8, -1., 22, 14, 1, 8, 2., 7.1206100983545184e-004, -0.5435984134674072, 0.2552855014801025, 0, 2, 0, 7, 21, 9, -1., 7, 10, 7, 3, 9., -0.3888005912303925, 0.6930956840515137, -0.1862079948186874, 0, 2, 16, 16, 1, 4, -1., 16, 17, 1, 2, 2., 2.5288251345045865e-004, 0.2914173901081085, -0.5620415806770325, 1, 2, 19, 15, 2, 6, -1., 17, 17, 2, 2, 3., -2.1006830502301455e-003, -0.6822040081024170, 0.1185996010899544, 0, 2, 6, 0, 15, 4, -1., 6, 1, 15, 2, 2., -3.2310429960489273e-003, 0.3972072899341583, -0.2774995863437653, 0, 2, 9, 16, 1, 4, -1., 9, 17, 1, 2, 2., 1.4478569937637076e-005, -0.5476933717727661, 0.2119608968496323, 0, 3, 8, 20, 8, 2, -1., 8, 20, 4, 1, 2., 12, 21, 4, 1, 2., -9.0244162129238248e-004, -0.8646997213363648, 0.1194489970803261, 0, 2, 0, 9, 3, 14, -1., 1, 9, 1, 14, 3., -1.5906910412013531e-003, 0.2919914126396179, -0.3928124904632568, 1, 2, 11, 1, 11, 4, -1., 11, 1, 11, 2, 2., 7.4913240969181061e-003, 0.2679530084133148, -0.4020768105983734, -1.1201709508895874, 11, 0, 2, 15, 20, 1, 2, -1., 15, 21, 1, 1, 2., -7.1240079705603421e-005, 0.2823083102703095, -0.4779424071311951, 1, 2, 2, 18, 1, 2, -1., 2, 18, 1, 1, 2., -2.6417701155878603e-004, 0.3084900975227356, -0.4036655128002167, 0, 2, 0, 14, 12, 6, -1., 0, 16, 12, 2, 3., 5.2890321239829063e-004, -0.7423822879791260, 0.1605536937713623, 0, 3, 4, 10, 2, 14, -1., 4, 10, 1, 7, 2., 5, 17, 1, 7, 2., 3.8283021422103047e-004, -0.6108828783035278, 0.1794416010379791, 0, 2, 22, 3, 2, 15, -1., 23, 3, 1, 15, 2., 5.4077422246336937e-003, -0.2767061889171600, 0.4017147123813629, 1, 2, 4, 17, 3, 1, -1., 5, 18, 1, 1, 3., -8.2620367174968123e-004, -0.8456827998161316, 0.1641048043966293, 0, 2, 21, 6, 3, 9, -1., 21, 9, 3, 3, 3., -8.9606801047921181e-003, -0.6698572039604187, 0.1270485967397690, 0, 2, 1, 7, 23, 4, -1., 1, 9, 23, 2, 2., -3.0286349356174469e-003, 0.1227105036377907, -0.7880274057388306, 0, 2, 4, 3, 20, 20, -1., 4, 13, 20, 10, 2., -0.0262723900377750, -0.7226560711860657, 0.1347829997539520, 0, 2, 14, 13, 7, 4, -1., 14, 15, 7, 2, 2., -5.0153239862993360e-004, 0.2890014052391052, -0.3537223935127258, 1, 2, 2, 6, 2, 2, -1., 2, 6, 2, 1, 2., -1.9847620569635183e-004, 0.2491115033626556, -0.4667024016380310, -1.0063530206680298, 12, 0, 2, 13, 15, 6, 4, -1., 13, 17, 6, 2, 2., -1.6098109772428870e-003, 0.2436411976814270, -0.5425583124160767, 0, 2, 17, 0, 7, 24, -1., 17, 8, 7, 8, 3., 3.0391800682991743e-003, 0.1427879035472870, -0.7677937150001526, 0, 2, 3, 7, 20, 8, -1., 13, 7, 10, 8, 2., -0.0111625995486975, -0.7964649796485901, 0.1309580951929092, 0, 2, 0, 7, 22, 1, -1., 11, 7, 11, 1, 2., -1.6689340118318796e-003, 0.2306797951459885, -0.4947401881217957, 0, 2, 7, 9, 8, 2, -1., 7, 10, 8, 1, 2., -8.8481552666053176e-004, 0.2005017995834351, -0.5158239006996155, 0, 2, 2, 0, 3, 18, -1., 2, 6, 3, 6, 3., -2.6040559168905020e-003, 0.1298092007637024, -0.7818121910095215, 0, 2, 2, 13, 3, 5, -1., 3, 13, 1, 5, 3., -2.3444599355570972e-004, -0.5695487260818481, 0.1478334069252014, 0, 2, 14, 16, 3, 4, -1., 15, 16, 1, 4, 3., 8.4604357834905386e-004, 0.1037243008613586, -0.8308842182159424, 0, 2, 10, 0, 12, 3, -1., 10, 1, 12, 1, 3., -2.4807569570839405e-003, 0.3425926864147186, -0.2719523906707764, 1, 2, 15, 16, 3, 1, -1., 16, 17, 1, 1, 3., -1.1127090547233820e-003, -0.8275328278541565, 0.1176175028085709, 0, 2, 22, 13, 2, 5, -1., 23, 13, 1, 5, 2., 1.4298419700935483e-003, -0.3477616012096405, 0.2652699053287506, 0, 2, 11, 14, 4, 6, -1., 11, 16, 4, 2, 3., -1.4572150539606810e-003, -0.8802363276481628, 0.1092033982276917, -1.0373339653015137, 13, 0, 2, 14, 15, 1, 2, -1., 14, 16, 1, 1, 2., -1.4507149899145588e-005, 0.2605004012584686, -0.4580149054527283, 1, 2, 6, 3, 6, 5, -1., 6, 3, 3, 5, 2., 0.0136784398928285, -0.7149971723556519, 0.1477705985307694, 1, 2, 2, 8, 1, 2, -1., 2, 8, 1, 1, 2., -7.3151881224475801e-005, 0.2058611065149307, -0.4995836019515991, 0, 2, 9, 17, 4, 4, -1., 9, 18, 4, 2, 2., -6.7043182207271457e-004, -0.7319483757019043, 0.1358278989791870, 0, 2, 10, 6, 4, 5, -1., 11, 6, 2, 5, 2., -1.1992789804935455e-003, 0.4456472992897034, -0.2521241009235382, 0, 2, 2, 21, 12, 2, -1., 8, 21, 6, 2, 2., -0.0117351496592164, -0.7972438931465149, 0.1424607038497925, 0, 2, 12, 8, 12, 15, -1., 16, 8, 4, 15, 3., -4.7361929900944233e-003, 0.1624221056699753, -0.5223402976989746, 0, 2, 0, 3, 20, 20, -1., 0, 13, 20, 10, 2., -0.1084595024585724, -0.7962973713874817, 0.1265926957130432, 1, 2, 16, 17, 4, 2, -1., 16, 17, 4, 1, 2., -3.2293208641931415e-004, -0.7129234075546265, 0.0899520069360733, 1, 2, 21, 14, 2, 5, -1., 21, 14, 1, 5, 2., 2.5980910286307335e-003, -0.2800100147724152, 0.3197942078113556, 1, 2, 12, 0, 12, 8, -1., 12, 0, 12, 4, 2., -7.5798099860548973e-003, -0.7153301239013672, 0.1406804025173187, 0, 2, 17, 0, 7, 24, -1., 17, 6, 7, 12, 2., -8.4003582596778870e-003, 0.1168404966592789, -0.6506950259208679, 0, 2, 13, 10, 3, 6, -1., 13, 12, 3, 2, 3., 3.6820198874920607e-003, -0.2631436884403229, 0.3865979909896851, -0.9257612824440002, 12, 0, 2, 8, 11, 9, 9, -1., 11, 14, 3, 3, 9., 0.0240733902901411, -0.4794333875179291, 0.2617827057838440, 0, 2, 17, 18, 7, 6, -1., 17, 21, 7, 3, 2., 1.9582170061767101e-003, -0.4434475898742676, 0.2301298975944519, 0, 2, 9, 8, 4, 2, -1., 9, 9, 4, 1, 2., -2.0559200493153185e-004, 0.1224080994725227, -0.7277694940567017, 0, 2, 7, 7, 7, 6, -1., 7, 9, 7, 2, 3., 1.0637210216373205e-003, -0.1582341045141220, 0.6447200775146484, 0, 2, 2, 9, 1, 9, -1., 2, 12, 1, 3, 3., -3.5040560760535300e-004, -0.5160586237907410, 0.2033808976411820, 0, 2, 1, 0, 1, 20, -1., 1, 10, 1, 10, 2., -1.5382179990410805e-003, 0.2029495984315872, -0.5412080287933350, 1, 2, 5, 11, 4, 3, -1., 5, 11, 2, 3, 2., 4.2215911671519279e-003, 0.1420246958732605, -0.6884710788726807, 0, 2, 1, 6, 14, 13, -1., 8, 6, 7, 13, 2., 4.0536639280617237e-003, 0.0946411192417145, -0.8890265226364136, 0, 2, 11, 6, 6, 4, -1., 13, 6, 2, 4, 3., 3.9104130119085312e-003, -0.2211245000362396, 0.4553441107273102, 1, 2, 15, 20, 2, 2, -1., 15, 20, 2, 1, 2., -5.8839347911998630e-004, -0.7423400878906250, 0.1466006040573120, 0, 2, 11, 7, 11, 2, -1., 11, 8, 11, 1, 2., 4.7331111272796988e-004, 0.0803736001253128, -0.8416292071342468, 0, 2, 14, 0, 7, 4, -1., 14, 1, 7, 2, 2., -1.4589539496228099e-003, 0.2730404138565064, -0.2989330887794495];
    module.handfist = new Float32Array(classifier);
    module.handfist.tilted = true;
})(objectdetect);


//handopen.js
(function(module) {
    "use strict";
	
    var classifier = [25,25,-1.4329270124435425e+000,7,0,2,0,2,24,21,-1.,6,2,12,21,2.,1.5003059804439545e-001,-8.1184512376785278e-001,6.7985910177230835e-001,1,2,21,1,2,6,-1.,21,1,2,3,2.,-2.6187319308519363e-003,1.4523890614509583e-001,-2.4056260287761688e-001,0,2,0,0,2,25,-1.,1,0,1,25,2.,1.3353739632293582e-003,-6.0511720180511475e-001,3.6618021130561829e-001,0,2,2,16,21,9,-1.,2,19,21,3,3.,3.1417140271514654e-003,-4.9187308549880981e-001,2.5102201104164124e-001,0,2,3,0,19,8,-1.,3,2,19,4,2.,6.2333769164979458e-004,-4.6784201264381409e-001,2.6779899001121521e-001,0,2,11,0,10,22,-1.,11,0,5,22,2.,5.8959048241376877e-002,-1.6091950237751007e-001,1.9723750650882721e-001,0,2,4,0,10,22,-1.,9,0,5,22,2.,6.2947690486907959e-002,-3.6895948648452759e-001,3.6813440918922424e-001,-1.3557660579681396e+000,11,0,2,0,0,24,25,-1.,6,0,12,25,2.,2.3747350275516510e-001,-6.5408688783645630e-001,4.9667519330978394e-001,0,2,21,1,4,22,-1.,21,1,2,22,2.,5.0346520729362965e-003,-6.9200718402862549e-001,3.3853441476821899e-001,0,2,0,1,4,22,-1.,2,1,2,22,2.,3.9370087906718254e-003,-6.5886509418487549e-001,2.1448600292205811e-001,0,2,2,1,21,21,-1.,9,1,7,21,3.,5.0707049667835236e-003,-5.2522331476211548e-001,5.9291750192642212e-002,0,2,2,0,19,8,-1.,2,2,19,4,2.,3.4051720285788178e-004,-5.2820461988449097e-001,2.4072030186653137e-001,0,2,2,17,21,8,-1.,2,19,21,4,2.,1.2807789971702732e-005,-5.5176711082458496e-001,1.9243550300598145e-001,0,2,2,11,6,3,-1.,4,11,2,3,3.,-5.3984248079359531e-003,4.7871538996696472e-001,-2.4212449789047241e-001,0,2,9,1,7,24,-1.,9,13,7,12,2.,1.3651129603385925e-001,-1.6812080144882202e-001,4.9736741185188293e-001,0,2,7,0,11,24,-1.,7,12,11,12,2.,-1.9071920216083527e-001,6.0721081495285034e-001,-2.9403430223464966e-001,0,2,1,0,23,2,-1.,1,1,23,1,2.,1.2038889690302312e-004,-4.9244078993797302e-001,2.4322469532489777e-001,0,2,9,11,6,3,-1.,11,11,2,3,3.,-6.1202510260045528e-003,5.7662928104400635e-001,-2.5555029511451721e-001,-1.5641080141067505e+000,20,0,2,0,5,24,15,-1.,8,5,8,15,3.,1.8524490296840668e-001,-5.9384208917617798e-001,3.3992278575897217e-001,0,2,23,0,2,25,-1.,23,0,1,25,2.,1.2689189752563834e-003,-6.4463311433792114e-001,2.5343731045722961e-001,0,2,0,0,2,25,-1.,1,0,1,25,2.,8.5763330571353436e-004,-6.7231202125549316e-001,2.4189129471778870e-001,0,2,5,5,15,15,-1.,5,10,15,5,3.,-1.6834350302815437e-002,3.2584258913993835e-001,-4.3302649259567261e-001,0,2,3,23,19,2,-1.,3,24,19,1,2.,-2.4595179638708942e-005,2.5265690684318542e-001,-5.1088571548461914e-001,0,2,2,5,21,15,-1.,9,10,7,5,9.,1.7257420113310218e-003,-4.4695881009101868e-001,1.2177280336618423e-001,0,2,10,5,5,20,-1.,10,15,5,10,2.,4.7322191298007965e-002,-2.6065969467163086e-001,4.1599690914154053e-001,0,2,9,0,7,22,-1.,9,11,7,11,2.,-9.2192016541957855e-002,4.9446830153465271e-001,-2.9402649402618408e-001,0,2,0,0,24,4,-1.,0,2,24,2,2.,2.5826389901340008e-003,-4.6076709032058716e-001,2.5506868958473206e-001,0,2,11,10,4,5,-1.,12,10,2,5,2.,-3.0530600342899561e-003,5.1746541261672974e-001,-2.3860910534858704e-001,0,2,11,11,3,3,-1.,12,11,1,3,3.,1.4302280033007264e-003,-1.8288139998912811e-001,5.9509581327438354e-001,0,2,1,0,24,25,-1.,9,0,8,25,3.,2.3731220513582230e-002,-8.0241280794143677e-001,1.1410690099000931e-001,0,2,10,11,4,3,-1.,11,11,2,3,2.,-1.7200269503518939e-003,4.9770259857177734e-001,-3.3559548854827881e-001,1,2,23,19,2,4,-1.,23,19,1,4,2.,2.4453289370285347e-005,-4.0247130393981934e-001,2.5604829192161560e-001,1,2,2,19,4,2,-1.,2,19,4,1,2.,2.2456999431597069e-005,-5.7257527112960815e-001,1.9648410379886627e-001,1,2,19,0,6,2,-1.,19,0,6,1,2.,-1.1040309800591785e-005,1.9324329495429993e-001,-5.3783118724822998e-001,1,2,5,0,2,5,-1.,5,0,1,5,2.,-2.4118829969665967e-005,2.0425009727478027e-001,-5.0164592266082764e-001,0,2,24,23,1,2,-1.,24,24,1,1,2.,-2.9135821387171745e-004,-7.6120328903198242e-001,1.1119560152292252e-001,0,2,0,0,1,24,-1.,0,12,1,12,2.,2.2033160552382469e-002,5.7622238993644714e-002,-9.1618537902832031e-001,0,2,24,7,1,18,-1.,24,16,1,9,2.,-1.2498879805207253e-002,-7.2695672512054443e-001,1.3170750439167023e-001,-1.4591870307922363e+000,17,0,2,0,0,12,25,-1.,6,0,6,25,2.,8.8611230254173279e-002,-6.6486412286758423e-001,3.5186940431594849e-001,0,2,1,7,24,11,-1.,9,7,8,11,3.,2.5681449100375175e-002,-8.6079347133636475e-001,9.6691556274890900e-002,0,2,0,1,2,24,-1.,1,1,1,24,2.,2.2021760742063634e-005,-8.0106097459793091e-001,1.1921170353889465e-001,0,2,0,13,25,12,-1.,0,16,25,6,2.,2.0681109745055437e-003,-6.6451412439346313e-001,2.0666299760341644e-001,0,2,0,0,25,12,-1.,0,3,25,6,2.,1.6312770312651992e-003,-6.8381088972091675e-001,2.5481811165809631e-001,0,2,1,0,24,25,-1.,9,0,8,25,3.,1.9836429506540298e-002,-9.5206391811370850e-001,1.2496689707040787e-001,0,2,3,0,19,4,-1.,3,1,19,2,2.,2.2290700144367293e-005,-7.0204389095306396e-001,1.9276830554008484e-001,0,2,1,23,24,2,-1.,1,24,24,1,2.,-2.2802520106779411e-005,2.1565049886703491e-001,-7.8502702713012695e-001,0,2,10,5,4,20,-1.,10,15,4,10,2.,3.5834241658449173e-002,-3.8406941294670105e-001,5.3787577152252197e-001,1,2,14,6,1,14,-1.,14,6,1,7,2.,1.0084280074806884e-004,-6.8384587764739990e-001,2.4612200260162354e-001,0,2,4,23,15,2,-1.,4,24,15,1,2.,2.6884470134973526e-002,-2.9663830995559692e-001,-2.6435000000000000e+003,0,2,24,0,1,24,-1.,24,12,1,12,2.,2.0637569949030876e-002,5.3151738643646240e-001,-7.9614728689193726e-001,0,2,0,0,1,16,-1.,0,8,1,8,2.,-8.8602686300873756e-003,-7.8123009204864502e-001,1.8032559752464294e-001,0,2,18,7,4,11,-1.,18,7,2,11,2.,-7.8016798943281174e-003,1.7774020135402679e-001,-1.0996480286121368e-001,0,2,0,2,14,23,-1.,7,2,7,23,2.,1.1463870108127594e-001,5.1441919803619385e-001,-2.2767600417137146e-001,0,2,24,23,1,2,-1.,24,24,1,1,2.,-2.6180568966083229e-004,-6.9460737705230713e-001,1.1731670051813126e-001,0,2,0,23,1,2,-1.,0,24,1,1,2.,-2.8006930369883776e-004,-7.9735141992568970e-001,1.0120259970426559e-001,-1.1637979745864868e+000,20,0,2,0,0,1,2,-1.,0,1,1,1,2.,2.9352991259656847e-004,1.3833090662956238e-001,-7.6414722204208374e-001,0,2,24,5,1,20,-1.,24,15,1,10,2.,-1.5867210924625397e-002,-9.0028488636016846e-001,5.1472321152687073e-002,0,2,0,5,1,20,-1.,0,15,1,10,2.,-1.6637140884995461e-002,-8.9705729484558105e-001,1.0005489736795425e-001,0,2,3,1,19,24,-1.,3,13,19,12,2.,-3.3240309357643127e-001,4.9737390875816345e-001,-1.9235250353813171e-001,0,2,5,0,15,24,-1.,5,12,15,12,2.,2.4854320287704468e-001,-2.7211311459541321e-001,4.5927569270133972e-001,0,2,24,7,1,18,-1.,24,16,1,9,2.,1.1056589893996716e-002,1.1864840239286423e-001,-7.7563858032226563e-001,0,2,8,8,8,10,-1.,8,13,8,5,2.,1.8648169934749603e-001,-1.2418299913406372e-002,-1.1346250000000000e+003,0,2,24,7,1,18,-1.,24,16,1,9,2.,1.7597459256649017e-002,2.5591930374503136e-002,-8.4127980470657349e-001,0,2,0,7,1,18,-1.,0,16,1,9,2.,1.1070669628679752e-002,1.0083609819412231e-001,-7.1428167819976807e-001,0,2,0,13,25,12,-1.,0,16,25,6,2.,1.6768550500273705e-002,-3.3646050095558167e-001,1.9811430573463440e-001,0,2,4,0,14,14,-1.,4,7,14,7,2.,4.3410068750381470e-001,-9.3027588445693254e-004,-1.2339289550781250e+003,0,2,23,0,2,2,-1.,23,1,2,1,2.,4.6659549116156995e-004,1.2081030011177063e-001,-5.8821451663970947e-001,0,2,0,0,25,2,-1.,0,1,25,1,2.,1.9694319926202297e-003,-3.2620209455490112e-001,2.1227480471134186e-001,0,2,12,11,4,4,-1.,13,11,2,4,2.,-2.8702169656753540e-003,4.8137769103050232e-001,-1.4962139725685120e-001,0,2,9,11,4,4,-1.,10,11,2,4,2.,-3.4756050445139408e-003,5.2802997827529907e-001,-1.3120299577713013e-001,0,2,23,0,2,4,-1.,23,1,2,2,2.,-5.4196082055568695e-004,-5.3317350149154663e-001,1.2100230157375336e-001,1,2,2,22,1,2,-1.,2,22,1,1,2.,-9.3427370302379131e-004,-8.8130372762680054e-001,5.8498218655586243e-002,0,2,24,22,1,2,-1.,24,23,1,1,2.,-2.8417719295248389e-004,-6.2143480777740479e-001,6.8724647164344788e-002,0,2,0,23,25,2,-1.,0,24,25,1,2.,-4.0356540121138096e-003,2.6959720253944397e-001,-2.3718340694904327e-001,0,2,24,21,1,4,-1.,24,23,1,2,2.,7.0708477869629860e-004,8.4266871213912964e-002,-4.5742911100387573e-001,-1.2382400035858154e+000,24,1,2,2,22,1,2,-1.,2,22,1,1,2.,4.6358350664377213e-004,1.8896600604057312e-001,-3.8676708936691284e-001,0,2,23,0,2,25,-1.,23,0,1,25,2.,3.8987519219517708e-003,-3.9730489253997803e-001,3.1238529086112976e-001,0,2,0,0,10,25,-1.,5,0,5,25,2.,5.8029189705848694e-002,-5.0608777999877930e-001,1.5904699265956879e-001,0,2,1,0,24,25,-1.,1,0,12,25,2.,-5.4033267498016357e-001,-7.6801401376724243e-001,1.1976829916238785e-001,0,2,0,1,1,24,-1.,0,7,1,12,2.,1.2194709852337837e-002,6.5259806811809540e-002,-8.2098531723022461e-001,0,2,23,0,2,25,-1.,23,0,1,25,2.,8.4217172116041183e-004,-2.5191161036491394e-001,3.1723741441965103e-002,0,2,0,1,2,24,-1.,1,1,1,24,2.,3.8863120134919882e-003,-3.1038621068000793e-001,2.2988179326057434e-001,1,2,24,1,1,2,-1.,24,1,1,1,2.,8.8707922259345651e-004,6.5289810299873352e-002,-6.9049417972564697e-001,1,2,1,1,2,1,-1.,1,1,1,1,2.,-4.1859821067191660e-004,-3.9824271202087402e-001,1.8126510083675385e-001,0,2,24,0,1,22,-1.,24,11,1,11,2.,-1.7866320908069611e-002,-9.4715738296508789e-001,7.5951322913169861e-002,0,2,0,0,1,24,-1.,0,8,1,8,3.,-1.1730570346117020e-002,-6.8169498443603516e-001,7.1461476385593414e-002,0,2,5,5,15,15,-1.,5,10,15,5,3.,-1.8845280632376671e-002,2.6420509815216064e-001,-2.7402049303054810e-001,1,2,1,0,2,1,-1.,1,0,1,1,2.,5.1623297622427344e-004,8.9989356696605682e-002,-6.5890562534332275e-001,0,3,17,12,2,6,-1.,18,12,1,3,2.,17,15,1,3,2.,-1.9588230643421412e-003,4.4965040683746338e-001,-1.2648980319499969e-001,0,3,6,12,2,6,-1.,6,12,1,3,2.,7,15,1,3,2.,-1.8352799816057086e-003,4.4554790854454041e-001,-1.2392920255661011e-001,0,2,14,12,6,2,-1.,16,12,2,2,3.,-4.6895779669284821e-003,4.2773500084877014e-001,-1.3527210056781769e-001,0,2,0,8,18,9,-1.,6,8,6,9,3.,1.9215959310531616e-001,8.4252431988716125e-002,-7.4916952848434448e-001,0,2,23,11,2,4,-1.,23,12,2,2,2.,5.6411779951304197e-004,7.7006638050079346e-002,-5.6502771377563477e-001,0,2,9,10,4,3,-1.,10,10,2,3,2.,2.8751920908689499e-003,-1.3198760151863098e-001,4.1225358843803406e-001,0,2,7,18,12,4,-1.,7,19,12,2,2.,7.7192699536681175e-003,7.7505782246589661e-002,-8.4410911798477173e-001,0,2,9,10,4,3,-1.,10,10,2,3,2.,-1.6325690085068345e-003,3.3561250567436218e-001,-1.5619030594825745e-001,0,2,23,11,2,4,-1.,23,12,2,2,2.,-5.6915491586551070e-004,-3.4847769141197205e-001,8.1965819001197815e-002,0,2,4,3,16,22,-1.,4,14,16,11,2.,-2.1694660186767578e-001,3.1710639595985413e-001,-1.4847409725189209e-001,0,2,4,0,21,24,-1.,4,12,21,12,2.,2.5057300925254822e-001,-2.3321990668773651e-001,3.4584110975265503e-001,-1.1826640367507935e+000,32,0,2,0,0,24,25,-1.,8,0,8,25,3.,3.6485868692398071e-001,-3.6243289709091187e-001,2.0066380500793457e-001,0,3,20,6,2,8,-1.,21,6,1,4,2.,20,10,1,4,2.,-3.7072061095386744e-003,5.8469599485397339e-001,-1.2000480294227600e-001,0,3,3,6,2,8,-1.,3,6,1,4,2.,4,10,1,4,2.,-3.7888090591877699e-003,5.5193948745727539e-001,-9.6978336572647095e-002,0,2,6,4,16,21,-1.,10,4,8,21,2.,6.6407203674316406e-002,-1.8292060494422913e-001,9.7074352204799652e-002,0,2,0,2,4,19,-1.,2,2,2,19,2.,3.8407989777624607e-003,-4.5010709762573242e-001,1.3275340199470520e-001,0,2,24,0,1,20,-1.,24,10,1,10,2.,1.5176840126514435e-002,8.6718283593654633e-002,-8.2534867525100708e-001,0,2,5,3,15,22,-1.,5,14,15,11,2.,2.1945759654045105e-001,-1.6291670501232147e-001,3.5320338606834412e-001,0,2,9,0,7,20,-1.,9,10,7,10,2.,-7.7002197504043579e-002,3.8327819108963013e-001,-1.9850799441337585e-001,0,2,1,0,22,2,-1.,1,1,22,1,2.,5.0508929416537285e-003,-1.9514580070972443e-001,2.8920450806617737e-001,0,2,24,0,1,20,-1.,24,10,1,10,2.,-1.6207909211516380e-002,-7.8625917434692383e-001,4.6221490949392319e-002,0,2,0,0,1,20,-1.,0,10,1,10,2.,1.6638509929180145e-002,5.8282759040594101e-002,-8.7408941984176636e-001,0,2,24,0,1,22,-1.,24,11,1,11,2.,-4.7077341005206108e-003,1.0838989913463593e-001,-9.1372027993202209e-002,0,2,0,0,1,22,-1.,0,11,1,11,2.,-1.7989320680499077e-002,-7.6009011268615723e-001,7.1595683693885803e-002,0,2,1,17,24,8,-1.,1,21,24,4,2.,-2.2045580670237541e-002,2.0044830441474915e-001,-2.5301960110664368e-001,0,2,3,0,19,18,-1.,3,9,19,9,2.,1.0939480364322662e-001,-1.9698250293731689e-001,2.8172031044960022e-001,0,2,23,23,1,2,-1.,23,24,1,1,2.,3.2741879113018513e-004,7.4757352471351624e-002,-6.2705790996551514e-001,0,2,1,23,1,2,-1.,1,24,1,1,2.,3.3313198946416378e-004,6.0775469988584518e-002,-6.4261537790298462e-001,0,2,23,21,2,4,-1.,23,22,2,2,2.,4.3790769996121526e-004,7.6970867812633514e-002,-4.7836649417877197e-001,0,2,0,21,2,4,-1.,0,22,2,2,2.,4.5484420843422413e-004,9.0992778539657593e-002,-4.8621150851249695e-001,0,2,2,17,21,8,-1.,2,19,21,4,2.,7.2560198605060577e-003,-2.6507800817489624e-001,1.9337640702724457e-001,0,2,10,11,4,2,-1.,11,11,2,2,2.,-2.2607750725001097e-003,4.2049959301948547e-001,-1.1367010325193405e-001,0,2,12,12,3,2,-1.,13,12,1,2,3.,-1.1031399480998516e-003,3.4452688694000244e-001,-1.0477790236473083e-001,0,2,4,2,14,4,-1.,4,3,14,2,2.,-1.9140050280839205e-003,-4.7198608517646790e-001,9.9808588624000549e-002,0,2,9,4,8,2,-1.,9,5,8,1,2.,-2.2288530599325895e-003,-6.2563192844390869e-001,5.8708198368549347e-002,0,3,10,10,2,6,-1.,10,10,1,3,2.,11,13,1,3,2.,-2.1744300611317158e-003,4.3151539564132690e-001,-1.1335399746894836e-001,0,3,13,8,2,8,-1.,14,8,1,4,2.,13,12,1,4,2.,2.8203260153532028e-003,-9.0162709355354309e-002,3.8637679815292358e-001,0,2,3,10,18,12,-1.,9,14,6,4,9.,3.4067618846893311e-001,5.5690128356218338e-002,-8.3676660060882568e-001,0,2,0,11,25,3,-1.,0,12,25,1,3.,6.3827941194176674e-003,3.7600088864564896e-002,-7.8409391641616821e-001,0,2,0,0,25,12,-1.,0,3,25,6,2.,1.1914909631013870e-001,3.1439449638128281e-002,-9.2239922285079956e-001,0,2,24,5,1,10,-1.,24,10,1,5,2.,-4.3900958262383938e-003,-3.9533978700637817e-001,2.1284699440002441e-002,0,2,0,5,1,10,-1.,0,10,1,5,2.,-6.1812077183276415e-004,2.3230640590190887e-001,-1.7483870685100555e-001,0,2,13,22,1,2,-1.,13,23,1,1,2.,-1.9955119933001697e-004,-2.8087100386619568e-001,1.0967289656400681e-001,-1.1619060039520264e+000,33,0,2,7,12,3,1,-1.,8,12,1,1,3.,8.8703620713204145e-004,-1.4286060631275177e-001,4.3664848804473877e-001,0,2,15,11,4,5,-1.,15,11,2,5,2.,1.2350199744105339e-002,-8.0335199832916260e-002,2.6076430082321167e-001,0,2,7,11,4,3,-1.,8,11,2,3,2.,-2.5250180624425411e-003,4.5786809921264648e-001,-1.2449479848146439e-001,0,2,14,12,3,1,-1.,15,12,1,1,3.,-7.8186811879277229e-004,4.1217720508575439e-001,-1.0820990055799484e-001,0,2,8,12,3,1,-1.,9,12,1,1,3.,6.6686311038210988e-004,-1.4924609661102295e-001,3.7527379393577576e-001,0,2,23,0,2,25,-1.,23,0,1,25,2.,1.0244899895042181e-003,-4.8530641198158264e-001,1.4233219623565674e-001,0,2,0,0,2,25,-1.,1,0,1,25,2.,1.2527270009741187e-003,-4.4631031155586243e-001,1.6024069488048553e-001,1,2,23,21,2,1,-1.,23,21,1,1,2.,4.7616599476896226e-004,1.4618170261383057e-001,-2.8740549087524414e-001,1,2,2,20,1,2,-1.,2,20,1,1,2.,4.2036260128952563e-004,1.7892700433731079e-001,-3.5512998700141907e-001,0,2,23,0,2,2,-1.,23,0,1,2,2.,4.3912709224969149e-004,1.3554279506206512e-001,-3.6231538653373718e-001,0,2,3,23,19,2,-1.,3,24,19,1,2.,-5.2080918103456497e-003,3.0311760306358337e-001,-1.6971330344676971e-001,0,2,23,0,2,2,-1.,23,0,1,2,2.,-8.5600721649825573e-004,-7.8621208667755127e-001,6.7641116678714752e-002,0,2,0,0,2,2,-1.,1,0,1,2,2.,4.3306438601575792e-004,1.1879850178956985e-001,-4.1017350554466248e-001,0,2,23,0,2,2,-1.,23,0,1,2,2.,2.1799209207529202e-005,-1.8755300343036652e-001,1.0719849914312363e-001,0,2,0,0,2,2,-1.,1,0,1,2,2.,2.2921649360796437e-005,-2.5931510329246521e-001,1.8351049721240997e-001,0,2,3,0,19,24,-1.,3,12,19,12,2.,3.3169940114021301e-001,-1.7855569720268250e-001,3.0729588866233826e-001,0,2,5,0,15,24,-1.,5,12,15,12,2.,-2.6880529522895813e-001,4.1601109504699707e-001,-1.6482029855251312e-001,0,2,0,0,25,8,-1.,0,4,25,4,2.,2.0318999886512756e-002,-2.8030520677566528e-001,2.1150949597358704e-001,0,2,2,0,21,3,-1.,9,1,7,1,9.,3.9052091538906097e-002,-1.9721250236034393e-001,2.2723379731178284e-001,0,3,19,9,4,8,-1.,21,9,2,4,2.,19,13,2,4,2.,7.9546272754669189e-003,-1.1499509960412979e-001,4.7643399238586426e-001,0,2,1,10,23,3,-1.,1,11,23,1,3.,6.8952748551964760e-003,6.1748500913381577e-002,-8.2518738508224487e-001,0,3,12,9,2,12,-1.,13,9,1,6,2.,12,15,1,6,2.,-3.5556990187615156e-003,2.7410700917243958e-001,-9.3571491539478302e-002,0,2,0,3,1,22,-1.,0,14,1,11,2.,2.0416190847754478e-002,4.7507200390100479e-002,-8.7137848138809204e-001,0,2,5,0,15,21,-1.,10,7,5,7,9.,4.1883000731468201e-001,4.1436489671468735e-002,-6.9378608465194702e-001,0,2,1,0,2,1,-1.,2,0,1,1,2.,-5.2820937708020210e-004,-8.0074387788772583e-001,3.5777650773525238e-002,0,3,19,9,4,8,-1.,21,9,2,4,2.,19,13,2,4,2.,-4.6537858434021473e-003,3.5810899734497070e-001,-1.2797290086746216e-001,0,3,2,9,4,8,-1.,2,9,2,4,2.,4,13,2,4,2.,9.7785359248518944e-003,-8.5733927786350250e-002,4.5907780528068542e-001,0,3,19,8,4,8,-1.,21,8,2,4,2.,19,12,2,4,2.,3.4061060287058353e-003,-6.7135937511920929e-002,1.7149560153484344e-001,0,3,2,8,4,8,-1.,2,8,2,4,2.,4,12,2,4,2.,-7.1988371200859547e-003,4.5996940135955811e-001,-1.2102840095758438e-001,0,2,0,8,25,4,-1.,0,9,25,2,2.,1.1576360091567039e-002,5.5191241204738617e-002,-8.8701897859573364e-001,0,2,0,11,2,4,-1.,0,12,2,2,2.,5.1951088244095445e-004,6.7860089242458344e-002,-4.9204811453819275e-001,0,2,1,0,23,8,-1.,1,2,23,4,2.,2.5765900500118732e-003,-2.8460198640823364e-001,1.2351959943771362e-001,0,2,5,3,15,18,-1.,5,9,15,6,3.,1.6835910081863403e-001,-6.5295182168483734e-002,6.7276817560195923e-001,-1.1686840057373047e+000,43,0,2,0,0,12,25,-1.,6,0,6,25,2.,8.0734930932521820e-002,-5.0151252746582031e-001,1.2320630252361298e-001,0,2,22,1,1,24,-1.,22,7,1,12,2.,4.9881008453667164e-003,-1.3929890096187592e-001,2.2033059597015381e-001,0,2,2,1,1,24,-1.,2,7,1,12,2.,5.5222441442310810e-003,-1.6725270450115204e-001,3.0543148517608643e-001,0,2,4,23,19,2,-1.,4,24,19,1,2.,-1.7651449888944626e-003,1.4461129903793335e-001,-1.1531510204076767e-001,0,2,1,2,23,21,-1.,1,9,23,7,3.,6.0122009366750717e-002,1.6416029632091522e-001,-3.8055491447448730e-001,0,2,1,2,24,21,-1.,9,9,8,7,9.,6.1538379639387131e-002,-5.2694129943847656e-001,8.2790613174438477e-002,0,2,0,0,16,24,-1.,8,0,8,24,2.,4.9553498625755310e-001,4.2942259460687637e-002,-6.7714440822601318e-001,0,2,24,7,1,18,-1.,24,16,1,9,2.,-1.3491280376911163e-002,-7.9471498727798462e-001,2.5981629267334938e-002,0,2,0,7,1,18,-1.,0,16,1,9,2.,-1.3543509878218174e-002,-7.9188191890716553e-001,4.7937188297510147e-002,0,2,0,0,25,12,-1.,0,3,25,6,2.,1.1810439638793468e-002,-2.8349700570106506e-001,1.2301079928874969e-001,0,2,5,21,15,3,-1.,10,22,5,1,9.,1.3551290147006512e-002,-2.0479810237884521e-001,1.8431070446968079e-001,0,2,9,19,8,2,-1.,9,20,8,1,2.,2.2155249025672674e-003,6.0262829065322876e-002,-6.4096707105636597e-001,0,2,11,1,1,2,-1.,11,2,1,1,2.,2.3545439762528986e-004,1.0644689947366714e-001,-3.2437419891357422e-001,0,2,6,0,13,6,-1.,6,2,13,2,3.,4.8105299356393516e-004,-3.0601179599761963e-001,1.3155519962310791e-001,0,2,12,23,1,2,-1.,12,24,1,1,2.,-2.0008509454783052e-004,-3.0324178934097290e-001,1.3613070547580719e-001,0,2,6,19,14,6,-1.,6,21,14,2,3.,2.3672120732953772e-005,-3.0009239912033081e-001,1.3083159923553467e-001,0,2,5,12,6,1,-1.,7,12,2,1,3.,3.6291049327701330e-003,-1.1187619715929031e-001,3.5764211416244507e-001,0,3,17,8,2,6,-1.,18,8,1,3,2.,17,11,1,3,2.,1.9785349722951651e-003,-9.9919758737087250e-002,3.7574121356010437e-001,0,3,6,8,2,6,-1.,6,8,1,3,2.,7,11,1,3,2.,-1.8082730239257216e-003,4.0861770510673523e-001,-1.0428240150213242e-001,0,2,23,24,2,1,-1.,23,24,1,1,2.,-5.0346890930086374e-004,-8.4599661827087402e-001,6.1041310429573059e-002,0,2,0,24,2,1,-1.,1,24,1,1,2.,-3.7712400080636144e-004,-7.1247512102127075e-001,3.3072318881750107e-002,0,2,15,9,4,3,-1.,16,9,2,3,2.,2.8025570791214705e-003,-8.1714242696762085e-002,2.4936139583587646e-001,0,2,6,9,4,3,-1.,7,9,2,3,2.,-2.5709250476211309e-003,3.5556420683860779e-001,-9.7475007176399231e-002,0,2,23,0,2,25,-1.,23,0,1,25,2.,4.7641480341553688e-003,-1.8403269350528717e-001,1.5445269644260406e-001,0,3,0,21,2,4,-1.,0,21,1,2,2.,1,23,1,2,2.,5.5376789532601833e-004,6.3511990010738373e-002,-5.3317540884017944e-001,0,2,23,0,2,25,-1.,23,0,1,25,2.,4.3237060308456421e-002,2.2280379198491573e-003,-6.4554607868194580e-001,0,2,0,0,2,25,-1.,1,0,1,25,2.,5.6785959750413895e-003,-1.8612809479236603e-001,1.8174830079078674e-001,0,2,23,15,2,2,-1.,23,15,1,2,2.,4.3273830669932067e-004,1.2502700090408325e-001,-2.7003818750381470e-001,0,2,8,19,9,3,-1.,8,20,9,1,3.,-3.7943569477647543e-003,-7.8249299526214600e-001,4.5233760029077530e-002,0,2,23,15,2,2,-1.,23,15,1,2,2.,2.9963750857859850e-003,-7.6169371604919434e-002,5.2830129861831665e-001,0,2,0,15,2,2,-1.,1,15,1,2,2.,3.5630981437861919e-004,1.4209270477294922e-001,-2.4754630029201508e-001,0,2,8,5,9,20,-1.,8,15,9,10,2.,1.1159469932317734e-001,-1.2094090133905411e-001,2.8498700261116028e-001,0,2,7,3,11,22,-1.,7,14,11,11,2.,-1.3539190590381622e-001,2.9897761344909668e-001,-2.0331899821758270e-001,0,2,2,6,23,4,-1.,2,8,23,2,2.,-3.0475310049951077e-003,-2.2049249708652496e-001,1.5314429998397827e-001,0,2,11,5,3,6,-1.,11,8,3,3,2.,-2.6199448620900512e-004,1.8473750352859497e-001,-2.2174119949340820e-001,0,2,6,0,15,1,-1.,11,0,5,1,3.,1.9398240372538567e-002,4.4195670634508133e-002,-6.4281028509140015e-001,0,2,0,0,1,18,-1.,0,9,1,9,2.,-1.5306820161640644e-002,-8.3298677206039429e-001,3.3107019960880280e-002,0,2,9,0,12,1,-1.,12,0,6,1,2.,2.9064790578559041e-004,-1.6691260039806366e-001,9.9145926535129547e-002,0,2,0,1,19,24,-1.,0,13,19,12,2.,2.1586589515209198e-001,-1.4913189411163330e-001,2.2601340711116791e-001,0,2,23,15,1,10,-1.,23,20,1,5,2.,-1.1482139816507697e-003,1.3337799906730652e-001,-8.3940923213958740e-002,0,2,0,6,24,12,-1.,12,6,12,12,2.,-1.2832109630107880e-001,2.6057571172714233e-001,-1.2779660522937775e-001,0,3,15,11,2,4,-1.,16,11,1,2,2.,15,13,1,2,2.,-1.3299930142238736e-003,3.9536279439926147e-001,-8.2496158778667450e-002,0,2,0,0,2,6,-1.,0,2,2,2,3.,-1.3658769894391298e-003,-4.2845389246940613e-001,8.1771567463874817e-002,-1.2197940349578857e+000,45,0,2,0,0,24,25,-1.,12,0,12,25,2.,-5.4697930812835693e-001,-7.4169278144836426e-001,6.5116211771965027e-002,0,2,22,11,1,14,-1.,22,18,1,7,2.,-2.9348989482969046e-003,2.0817759633064270e-001,-1.0431099683046341e-001,0,2,0,9,21,8,-1.,7,9,7,8,3.,4.2346090078353882e-002,-4.1431620717048645e-001,1.0494910180568695e-001,0,2,5,12,20,3,-1.,10,12,10,3,2.,2.0167229231446981e-003,-2.9576519131660461e-001,5.8207400143146515e-002,0,2,5,5,15,15,-1.,5,10,15,5,3.,-2.3280899971723557e-002,2.4461050331592560e-001,-2.0072369277477264e-001,0,2,22,0,1,24,-1.,22,6,1,12,2.,5.2206241525709629e-003,-6.9155037403106689e-002,1.1710409820079803e-001,0,2,2,0,1,24,-1.,2,6,1,12,2.,5.0357701256871223e-003,-1.5814490616321564e-001,2.8217938542366028e-001,0,2,0,9,25,16,-1.,0,13,25,8,2.,1.7077940702438354e-001,5.2497748285531998e-002,-8.5689657926559448e-001,0,2,0,0,3,1,-1.,1,0,1,1,3.,-3.2828870462253690e-004,-4.5315450429916382e-001,6.7810378968715668e-002,0,3,18,11,2,6,-1.,19,11,1,3,2.,18,14,1,3,2.,-2.2234760690480471e-003,4.0166100859642029e-001,-1.1181300133466721e-001,0,3,5,11,2,6,-1.,5,11,1,3,2.,6,14,1,3,2.,-2.2535501047968864e-003,3.9260658621788025e-001,-9.2809401452541351e-002,0,3,20,10,4,8,-1.,22,10,2,4,2.,20,14,2,4,2.,-7.9935323446989059e-003,4.2978098988533020e-001,-8.7345071136951447e-002,0,3,1,10,4,8,-1.,1,10,2,4,2.,3,14,2,4,2.,-9.5514543354511261e-003,4.8636689782142639e-001,-7.3955677449703217e-002,0,2,24,13,1,6,-1.,24,15,1,2,3.,7.9448771430179477e-004,9.2045426368713379e-002,-4.4167259335517883e-001,0,2,0,14,1,6,-1.,0,16,1,2,3.,5.6366110220551491e-004,8.5762083530426025e-002,-3.9137899875640869e-001,0,2,8,1,15,15,-1.,13,6,5,5,9.,3.4115129709243774e-001,2.1570369601249695e-002,-6.5657228231430054e-001,0,2,7,7,6,9,-1.,9,7,2,9,3.,-1.3932379893958569e-002,3.7450811266899109e-001,-9.4087198376655579e-002,0,2,11,10,4,4,-1.,12,10,2,4,2.,-3.4664489794522524e-003,3.3531159162521362e-001,-1.0363130271434784e-001,1,2,5,1,12,4,-1.,9,5,4,4,3.,1.1305399984121323e-001,4.4492159038782120e-002,-8.0388927459716797e-001,0,2,3,13,22,3,-1.,3,14,22,1,3.,7.3196208104491234e-003,2.6117980480194092e-002,-7.5850278139114380e-001,0,2,10,12,4,2,-1.,11,12,2,2,2.,-1.2547730002552271e-003,2.6369830965995789e-001,-1.2721140682697296e-001,0,2,21,0,4,25,-1.,21,0,2,25,2.,5.4105562157928944e-003,-4.2188149690628052e-001,1.2777450680732727e-001,0,2,0,0,4,25,-1.,2,0,2,25,2.,5.0612930208444595e-003,-4.5063719153404236e-001,7.7225938439369202e-002,1,2,24,0,1,2,-1.,24,0,1,1,2.,-4.3663478572852910e-004,-3.0216220021247864e-001,1.4423480629920959e-001,1,2,1,0,2,1,-1.,1,0,1,1,2.,-4.6671440941281617e-004,-3.0956488847732544e-001,1.2610529363155365e-001,0,2,0,6,25,2,-1.,0,7,25,1,2.,3.1374259851872921e-003,1.0157799720764160e-001,-3.6539548635482788e-001,1,2,1,0,2,1,-1.,1,0,1,1,2.,-2.2114549210527912e-005,1.2883719801902771e-001,-2.5539168715476990e-001,0,2,11,12,3,1,-1.,12,12,1,1,3.,3.6453141365200281e-004,-1.4327269792556763e-001,2.3675279319286346e-001,0,2,1,12,21,3,-1.,1,13,21,1,3.,6.0733011923730373e-003,4.9781698733568192e-002,-6.9410818815231323e-001,0,2,18,19,6,6,-1.,18,22,6,3,2.,-2.6409518904983997e-003,1.1159580200910568e-001,-1.3221520185470581e-001,0,2,11,22,1,2,-1.,11,23,1,1,2.,-1.2848649930674583e-004,-2.5748521089553833e-001,1.2487880140542984e-001,0,2,16,19,9,6,-1.,16,22,9,3,2.,-2.7002869173884392e-002,-2.1309000253677368e-001,2.2851640358567238e-002,0,2,5,23,14,2,-1.,5,24,14,1,2.,-5.5548627860844135e-003,3.4896078705787659e-001,-1.2400159984827042e-001,0,2,2,0,21,2,-1.,2,1,21,1,2.,4.3782647699117661e-003,-1.5955279767513275e-001,2.1142059564590454e-001,0,2,0,14,17,3,-1.,0,15,17,1,3.,5.0675170496106148e-003,5.1273059099912643e-002,-6.7377299070358276e-001,0,2,24,22,1,3,-1.,24,23,1,1,3.,3.8793749990873039e-004,4.5997820794582367e-002,-7.1641021966934204e-001,0,2,1,15,1,10,-1.,1,20,1,5,2.,-1.4580220449715853e-003,2.1615679562091827e-001,-1.4839789271354675e-001,0,2,7,1,11,24,-1.,7,13,11,12,2.,2.4079500138759613e-001,-1.1823660135269165e-001,3.0170598626136780e-001,0,2,8,0,9,24,-1.,8,12,9,12,2.,-1.8808209896087646e-001,3.1144750118255615e-001,-1.3705970346927643e-001,0,2,24,20,1,4,-1.,24,22,1,2,2.,-7.0596951991319656e-004,-4.3143850564956665e-001,8.5756696760654449e-002,0,3,1,8,4,8,-1.,1,8,2,4,2.,3,12,2,4,2.,7.6330509036779404e-003,-8.5229426622390747e-002,4.0618151426315308e-001,0,2,22,23,3,2,-1.,23,23,1,2,3.,-5.4063898278400302e-004,-2.7844938635826111e-001,5.3362339735031128e-002,0,2,0,8,1,10,-1.,0,13,1,5,2.,8.0850580707192421e-004,-1.5673060715198517e-001,2.2427199780941010e-001,0,2,24,9,1,16,-1.,24,13,1,8,2.,-9.0161375701427460e-003,-7.6493132114410400e-001,2.5498120114207268e-002,0,2,0,9,1,16,-1.,0,13,1,8,2.,5.7115959934890270e-003,6.0737568885087967e-002,-6.1655932664871216e-001,-1.1867749691009521e+000,52,0,2,5,21,15,3,-1.,10,21,5,3,3.,1.8004509806632996e-001,7.1775932156015188e-005,-1.2683170166015625e+003,0,2,3,23,22,2,-1.,3,24,22,1,2.,-3.2704269979149103e-003,2.1751649677753448e-001,-2.1053729951381683e-001,0,3,3,12,2,6,-1.,3,12,1,3,2.,4,15,1,3,2.,2.8901069890707731e-003,-9.4649657607078552e-002,4.4793319702148438e-001,0,2,1,0,24,25,-1.,7,0,12,25,2.,2.6834228634834290e-001,-3.4015381336212158e-001,1.3912549614906311e-001,0,3,4,9,2,6,-1.,4,9,1,3,2.,5,12,1,3,2.,-2.9544678982347250e-003,4.5975801348686218e-001,-8.2894280552864075e-002,0,2,5,19,19,6,-1.,5,22,19,3,2.,-8.4115490317344666e-002,-2.7309590578079224e-001,6.5024472773075104e-002,0,3,4,9,2,6,-1.,4,9,1,3,2.,5,12,1,3,2.,2.6462629903107882e-003,-8.5304662585258484e-002,4.3064919114112854e-001,0,2,7,11,18,9,-1.,13,14,6,3,9.,2.3374849557876587e-001,3.1148020178079605e-002,-7.0049768686294556e-001,0,2,0,0,24,1,-1.,12,0,12,1,2.,1.3991080224514008e-002,6.3895016908645630e-002,-3.8017541170120239e-001,0,2,7,11,18,6,-1.,13,13,6,2,9.,1.5294119715690613e-002,-1.3300269842147827e-001,8.8719643652439117e-002,0,2,10,12,3,2,-1.,11,12,1,2,3.,1.3851210242137313e-003,-8.3899021148681641e-002,3.4786149859428406e-001,0,2,11,11,4,3,-1.,12,11,2,3,2.,4.0411897934973240e-003,-9.6694447100162506e-002,3.8513410091400146e-001,0,2,10,11,4,3,-1.,11,11,2,3,2.,-1.5105110360309482e-003,2.7030730247497559e-001,-1.4276629686355591e-001,0,2,7,24,12,1,-1.,10,24,6,1,2.,1.1216199956834316e-002,5.2318520843982697e-002,-7.4331712722778320e-001,0,2,0,0,2,4,-1.,0,1,2,2,2.,4.6090059913694859e-004,6.1226818710565567e-002,-4.4167301058769226e-001,0,2,4,9,18,9,-1.,10,12,6,3,9.,2.4240539968013763e-001,3.5296630114316940e-002,-8.2463300228118896e-001,0,2,0,0,3,4,-1.,0,1,3,2,2.,-6.0484587447717786e-004,-4.0272709727287292e-001,7.1387499570846558e-002,0,2,10,0,15,25,-1.,15,0,5,25,3.,3.5710370540618896e-001,1.8752589821815491e-002,-6.8163007497787476e-001,0,2,0,8,16,9,-1.,4,8,8,9,2.,1.1522459983825684e-001,4.6177390962839127e-002,-6.7330968379974365e-001,0,2,16,0,8,6,-1.,16,3,8,3,2.,3.8151650223881006e-003,-1.2972660362720490e-001,8.8695816695690155e-002,0,2,0,20,21,2,-1.,0,21,21,1,2.,1.3831140240654349e-003,9.5345683395862579e-002,-3.3529379963874817e-001,1,2,14,22,1,2,-1.,14,22,1,1,2.,5.1254231948405504e-004,1.0987920314073563e-001,-2.7034878730773926e-001,0,2,0,0,11,12,-1.,0,4,11,4,3.,6.1746072024106979e-003,-2.1200719475746155e-001,1.4264079928398132e-001,0,2,8,0,10,15,-1.,8,5,10,5,3.,1.0676769912242889e-001,4.1373148560523987e-002,-7.0405578613281250e-001,0,2,4,24,12,1,-1.,7,24,6,1,2.,9.7706951200962067e-003,4.0702451020479202e-002,-6.3800191879272461e-001,0,3,12,6,2,10,-1.,13,6,1,5,2.,12,11,1,5,2.,2.8201229870319366e-003,-9.4522736966609955e-002,2.6788440346717834e-001,0,2,0,22,1,3,-1.,0,23,1,1,3.,4.1142830741591752e-004,4.7475989907979965e-002,-6.3001567125320435e-001,0,2,23,10,2,8,-1.,23,14,2,4,2.,1.5934780240058899e-003,-1.0703609883785248e-001,1.6400060057640076e-001,0,2,0,0,24,1,-1.,12,0,12,1,2.,-1.1865469627082348e-002,-3.5861191153526306e-001,8.3961293101310730e-002,0,2,23,0,2,25,-1.,23,0,1,25,2.,4.1225277818739414e-003,-2.3882789909839630e-001,1.4402189850807190e-001,0,2,1,3,20,9,-1.,11,3,10,9,2.,-1.3517889380455017e-001,4.7490730881690979e-001,-6.7431576550006866e-002,0,3,14,8,2,8,-1.,15,8,1,4,2.,14,12,1,4,2.,2.7560358867049217e-003,-7.1827188134193420e-002,2.9079490900039673e-001,0,2,10,2,5,4,-1.,10,4,5,2,2.,-4.2972611263394356e-003,-5.5687338113784790e-001,5.6816298514604568e-002,1,2,14,0,2,3,-1.,14,0,1,3,2.,-1.2103000335628167e-004,-1.3359540700912476e-001,1.1837910115718842e-001,0,3,11,3,2,14,-1.,11,3,1,7,2.,12,10,1,7,2.,-2.4500500876456499e-003,2.5945881009101868e-001,-1.2817199528217316e-001,0,2,23,10,2,8,-1.,23,14,2,4,2.,-1.7446579877287149e-003,2.6169461011886597e-001,-1.3044109940528870e-001,0,2,10,23,1,2,-1.,10,24,1,1,2.,-1.6035139560699463e-004,-2.4382220208644867e-001,1.2862069904804230e-001,0,2,9,19,10,6,-1.,9,21,10,2,3.,1.8494970572646707e-004,-2.3383130133152008e-001,1.1913470178842545e-001,0,2,3,0,19,3,-1.,3,1,19,1,3.,2.8866168577224016e-004,-2.0316019654273987e-001,1.5361200273036957e-001,0,2,24,0,1,16,-1.,24,8,1,8,2.,1.1300699785351753e-002,6.2957696616649628e-002,-7.8750622272491455e-001,0,2,7,4,11,3,-1.,7,5,11,1,3.,5.8404598385095596e-003,1.7734849825501442e-002,-8.5410207509994507e-001,0,3,23,0,2,24,-1.,24,0,1,12,2.,23,12,1,12,2.,-8.3003882318735123e-003,2.2870020568370819e-001,-4.5239541679620743e-002,0,2,5,5,15,3,-1.,10,5,5,3,3.,1.0016419691964984e-003,-2.9350730776786804e-001,9.6414111554622650e-002,0,2,23,0,2,25,-1.,23,0,1,25,2.,-1.0042509995400906e-002,-5.9852880239486694e-001,4.5914249494671822e-003,0,2,0,0,2,25,-1.,1,0,1,25,2.,4.0912739932537079e-003,-2.1593970060348511e-001,1.2923860549926758e-001,0,2,23,7,2,3,-1.,23,7,1,3,2.,5.0562847172841430e-004,1.5741920471191406e-001,-2.5665798783302307e-001,0,2,0,7,2,3,-1.,1,7,1,3,2.,5.2078161388635635e-004,1.4819410443305969e-001,-2.3445880413055420e-001,0,2,23,8,2,1,-1.,23,8,1,1,2.,1.6813799738883972e-003,-6.6810980439186096e-002,4.9866899847984314e-001,0,2,0,8,2,1,-1.,1,8,1,1,2.,1.4866109704598784e-003,-6.4803972840309143e-002,4.2053240537643433e-001,0,3,12,6,2,12,-1.,13,6,1,6,2.,12,12,1,6,2.,-2.1427311003208160e-003,2.1503530442714691e-001,-9.4888381659984589e-002,0,2,1,19,15,3,-1.,6,19,5,3,3.,1.2026890181005001e-002,-1.7491519451141357e-001,1.6060090065002441e-001,0,2,22,23,3,2,-1.,23,23,1,2,3.,5.4962979629635811e-004,7.9216390848159790e-002,-3.6075818538665771e-001,-1.1352620124816895e+000,56,0,2,10,13,5,9,-1.,10,16,5,3,3.,2.0191150251775980e-003,-2.1191939711570740e-001,1.7960040271282196e-001,1,2,13,12,5,8,-1.,11,14,5,4,2.,2.5026449002325535e-003,-1.2992329895496368e-001,7.0980481803417206e-002,0,2,10,0,5,20,-1.,10,10,5,10,2.,-5.3158570080995560e-002,2.7662891149520874e-001,-1.7133300006389618e-001,0,2,12,16,3,8,-1.,12,20,3,4,2.,1.1209100193809718e-005,-1.4314560592174530e-001,2.5325238704681396e-001,0,2,8,2,8,20,-1.,8,7,8,10,2.,-7.1482710540294647e-002,-6.9515037536621094e-001,5.4300498217344284e-002,0,2,8,19,10,4,-1.,8,21,10,2,2.,2.8659540694206953e-003,4.6016551554203033e-002,-2.9052281379699707e-001,0,2,9,17,3,6,-1.,9,20,3,3,2.,1.9679629986057989e-005,-1.7965799570083618e-001,2.0140969753265381e-001,0,2,0,23,25,2,-1.,0,24,25,1,2.,-5.2277408540248871e-003,2.5270029902458191e-001,-1.6386799514293671e-001,0,3,1,7,2,6,-1.,1,7,1,3,2.,2,10,1,3,2.,3.0542609747499228e-003,-7.1575798094272614e-002,5.0366252660751343e-001,0,2,24,22,1,2,-1.,24,23,1,1,2.,-2.9728360823355615e-004,-5.2938801050186157e-001,5.1399130374193192e-002,0,2,0,11,4,3,-1.,2,11,2,3,2.,-1.0779739823192358e-003,3.7530121207237244e-001,-9.3900568783283234e-002,0,2,24,22,1,2,-1.,24,23,1,1,2.,-2.2623709810432047e-005,1.6981379687786102e-001,-1.1134230345487595e-001,0,2,0,22,1,2,-1.,0,23,1,1,2.,-2.6898880605585873e-004,-5.2503097057342529e-001,6.3903756439685822e-002,0,2,4,0,17,2,-1.,4,1,17,1,2.,4.3080640025436878e-003,-1.6974890232086182e-001,2.1191169321537018e-001,0,2,0,1,1,2,-1.,0,2,1,1,2.,2.8652910259552300e-004,6.9832988083362579e-002,-5.3953951597213745e-001,0,2,17,21,8,4,-1.,17,23,8,2,2.,-1.8647660035640001e-003,7.9187482595443726e-002,-1.0709100216627121e-001,0,2,0,0,2,24,-1.,1,0,1,24,2.,1.0851949919015169e-003,-3.9847779273986816e-001,8.5343867540359497e-002,0,2,22,20,2,2,-1.,22,20,1,2,2.,4.0944988722912967e-004,5.4056350141763687e-002,-1.4176020026206970e-001,0,2,1,20,2,2,-1.,2,20,1,2,2.,4.2084971209987998e-004,1.3462479412555695e-001,-2.5249311327934265e-001,1,2,21,20,4,1,-1.,21,20,2,1,2.,1.6839290037751198e-004,-2.2796970605850220e-001,9.5340102910995483e-002,1,2,4,20,1,4,-1.,4,20,1,2,2.,1.4562309661414474e-004,-3.1346321105957031e-001,1.2245950102806091e-001,0,2,11,14,3,3,-1.,12,15,1,1,9.,1.6215200303122401e-003,-1.2621709704399109e-001,2.5915551185607910e-001,0,2,12,23,1,2,-1.,12,24,1,1,2.,-3.3472100767539814e-005,-1.8671259284019470e-001,1.6651690006256104e-001,0,3,12,8,2,8,-1.,13,8,1,4,2.,12,12,1,4,2.,-2.5778179988265038e-003,2.5478971004486084e-001,-8.0635949969291687e-002,0,2,1,5,18,9,-1.,7,8,6,3,9.,2.2081619501113892e-001,5.3643438965082169e-002,-6.6497838497161865e-001,0,2,23,10,2,2,-1.,23,10,1,2,2.,3.1700119143351912e-004,7.9098179936408997e-002,-1.5417550504207611e-001,0,2,0,0,1,16,-1.,0,8,1,8,2.,1.2999719940125942e-002,3.6135278642177582e-002,-8.1742262840270996e-001,0,3,12,8,2,8,-1.,13,8,1,4,2.,12,12,1,4,2.,1.3553650351241231e-003,-9.7845867276191711e-002,1.7422780394554138e-001,0,2,5,17,15,2,-1.,10,17,5,2,3.,8.5435097571462393e-004,-2.8668859601020813e-001,1.0333210229873657e-001,0,2,5,1,18,3,-1.,11,2,6,1,9.,1.9186370074748993e-002,-2.0520329475402832e-001,1.4288300275802612e-001,0,2,12,0,1,2,-1.,12,1,1,1,2.,1.8162580090574920e-004,1.3736839592456818e-001,-2.5909510254859924e-001,0,2,0,3,25,22,-1.,0,14,25,11,2.,1.9275680184364319e-001,-1.5659409761428833e-001,2.1485829353332520e-001,0,2,1,2,15,3,-1.,6,3,5,1,9.,1.2056250125169754e-002,-2.2499039769172668e-001,2.1334210038185120e-001,0,3,12,8,2,8,-1.,13,8,1,4,2.,12,12,1,4,2.,-1.0883549693971872e-003,1.2353979796171188e-001,-7.4455857276916504e-002,0,3,11,8,2,8,-1.,11,8,1,4,2.,12,12,1,4,2.,-2.4255490861833096e-003,3.1007918715476990e-001,-9.9332652986049652e-002,0,2,14,2,1,18,-1.,14,8,1,6,3.,9.0482030063867569e-003,-8.5626669228076935e-002,2.4705639481544495e-001,0,2,1,12,18,9,-1.,7,15,6,3,9.,2.3379500210285187e-001,4.8708219081163406e-002,-6.3548052310943604e-001,0,2,7,3,12,3,-1.,7,4,12,1,3.,4.6182200312614441e-003,3.2066959887742996e-002,-6.5930128097534180e-001,0,2,8,1,9,1,-1.,11,1,3,1,3.,7.6137272117193788e-005,-2.3533040285110474e-001,1.1577039957046509e-001,0,2,5,0,15,1,-1.,10,0,5,1,3.,1.7868179827928543e-002,5.7103220373392105e-002,-6.0223627090454102e-001,0,3,8,9,2,8,-1.,8,9,1,4,2.,9,13,1,4,2.,-2.1019289270043373e-003,2.6925888657569885e-001,-1.0575859993696213e-001,0,3,15,9,2,6,-1.,16,9,1,3,2.,15,12,1,3,2.,3.3772839233279228e-003,-5.3210329264402390e-002,3.5539248585700989e-001,0,2,6,5,3,12,-1.,7,9,1,4,9.,1.0936450213193893e-002,-1.1338409781455994e-001,2.4860809743404388e-001,0,2,5,11,15,3,-1.,5,12,15,1,3.,6.7958370782434940e-003,3.0205719172954559e-002,-9.6363908052444458e-001,0,2,7,9,11,3,-1.,7,10,11,1,3.,4.3736519291996956e-003,2.9778029769659042e-002,-6.4715677499771118e-001,0,2,16,21,9,4,-1.,16,23,9,2,2.,1.0398699901998043e-002,4.1304989717900753e-003,-3.6711278557777405e-001,0,2,5,11,4,1,-1.,6,11,2,1,2.,-1.0460240300744772e-003,2.8792479634284973e-001,-8.5172623395919800e-002,0,2,12,23,1,2,-1.,12,24,1,1,2.,3.9401830872520804e-004,3.9254769682884216e-002,-6.4034730195999146e-001,0,2,0,21,9,4,-1.,0,23,9,2,2.,-2.0856719929724932e-003,1.4763970673084259e-001,-1.6981109976768494e-001,0,2,23,10,2,3,-1.,23,10,1,3,2.,3.7645150441676378e-003,-6.3431486487388611e-002,4.0955379605293274e-001,0,2,0,10,2,3,-1.,1,10,1,3,2.,4.8305589007213712e-004,1.5586610138416290e-001,-2.3883299529552460e-001,0,2,22,0,2,12,-1.,22,6,2,6,2.,4.0211779996752739e-003,-1.2030039727687836e-001,1.7619979381561279e-001,0,2,2,0,1,12,-1.,2,6,1,6,2.,2.5966949760913849e-003,-1.4575859904289246e-001,2.4293899536132813e-001,0,2,22,4,3,6,-1.,22,7,3,3,2.,-8.9815730461850762e-004,2.2666700184345245e-001,-1.6364639997482300e-001,0,2,0,4,3,6,-1.,0,7,3,3,2.,-6.2149699078872800e-004,2.0900680124759674e-001,-1.6018569469451904e-001,0,2,1,1,23,4,-1.,1,3,23,2,2.,2.3780961055308580e-003,-2.4557930231094360e-001,1.1902090162038803e-001,-1.0871520042419434e+000,51,0,2,0,1,24,23,-1.,12,1,12,23,2.,6.0245269536972046e-001,5.2337121218442917e-002,-7.8507578372955322e-001,0,2,24,11,1,14,-1.,24,18,1,7,2.,6.6552129574120045e-003,7.1143716573715210e-002,-5.4219800233840942e-001,0,2,5,19,15,6,-1.,10,21,5,2,9.,2.7373209595680237e-002,-2.2720469534397125e-001,1.5262730419635773e-001,0,2,1,24,24,1,-1.,1,24,12,1,2.,1.3735990040004253e-002,1.2475749850273132e-001,-3.0287069082260132e-001,0,2,1,4,1,12,-1.,1,10,1,6,2.,2.5980870705097914e-003,-1.2733310461044312e-001,2.7191510796546936e-001,0,2,18,5,7,12,-1.,18,11,7,6,2.,-1.0497280210256577e-001,-7.0821052789688110e-001,-1.9078690093010664e-003,0,2,0,1,7,24,-1.,0,7,7,12,2.,1.1283349990844727e-001,4.2468018829822540e-002,-7.8128588199615479e-001,0,3,18,10,2,4,-1.,19,10,1,2,2.,18,12,1,2,2.,1.7136579845100641e-003,-8.5178561508655548e-002,4.2818519473075867e-001,0,3,5,10,2,4,-1.,5,10,1,2,2.,6,12,1,2,2.,-1.2761510442942381e-003,3.7203249335289001e-001,-7.8054942190647125e-002,0,3,18,10,2,4,-1.,19,10,1,2,2.,18,12,1,2,2.,-1.6786810010671616e-003,4.5170649886131287e-001,-9.5365412533283234e-002,0,3,5,10,2,4,-1.,5,10,1,2,2.,6,12,1,2,2.,1.0452580172568560e-003,-1.0327780246734619e-001,3.1057640910148621e-001,0,2,20,24,4,1,-1.,20,24,2,1,2.,-1.2748680310323834e-003,-5.9134918451309204e-001,6.3396677374839783e-002,0,2,2,11,18,3,-1.,8,11,6,3,3.,-9.1730579733848572e-003,-5.1909697055816650e-001,5.8642920106649399e-002,0,2,24,11,1,14,-1.,24,18,1,7,2.,-8.5946340113878250e-003,-6.7389839887619019e-001,3.9074189960956573e-002,0,2,0,9,18,9,-1.,6,12,6,3,9.,1.7572590708732605e-001,7.0220336318016052e-002,-4.8357391357421875e-001,0,2,24,11,1,14,-1.,24,18,1,7,2.,1.2705760309472680e-003,-1.1456940323114395e-001,1.6797809302806854e-001,0,2,11,1,3,8,-1.,11,5,3,4,2.,-2.1443589503178373e-005,2.1516430377960205e-001,-1.7952880263328552e-001,0,2,24,0,1,22,-1.,24,11,1,11,2.,1.9370870664715767e-002,2.8284879401326180e-002,-8.3156830072402954e-001,0,2,0,0,1,22,-1.,0,11,1,11,2.,-2.0381100475788116e-002,-9.0958088636398315e-001,2.6280429214239120e-002,0,2,0,0,25,12,-1.,0,3,25,6,2.,2.6016689836978912e-002,-2.0010340213775635e-001,1.7443889379501343e-001,0,2,5,0,15,18,-1.,5,9,15,9,2.,1.0690639913082123e-001,-1.6266860067844391e-001,2.2835870087146759e-001,0,2,1,15,23,10,-1.,1,20,23,5,2.,-3.4786250442266464e-002,2.0793099701404572e-001,-2.0116269588470459e-001,0,2,10,22,1,2,-1.,10,23,1,1,2.,-1.9677329692058265e-004,-3.1131440401077271e-001,1.1807250231504440e-001,0,2,20,24,4,1,-1.,20,24,2,1,2.,6.5192329930141568e-004,8.2236677408218384e-002,-1.7708389461040497e-001,0,2,1,24,4,1,-1.,3,24,2,1,2.,-1.4959790278226137e-003,-7.1390831470489502e-001,4.2847748845815659e-002,0,2,23,6,1,12,-1.,23,12,1,6,2.,2.7109330985695124e-003,-1.0781349986791611e-001,2.0900200307369232e-001,0,2,0,5,1,20,-1.,0,10,1,10,2.,7.5823841616511345e-003,5.3877390921115875e-002,-5.6809967756271362e-001,0,2,9,20,15,3,-1.,14,21,5,1,9.,1.0195979848504066e-002,-1.9075849652290344e-001,1.4719660580158234e-001,0,2,1,20,15,3,-1.,6,21,5,1,9.,1.3070380315184593e-002,-2.1738119423389435e-001,1.9392399489879608e-001,0,2,11,1,3,2,-1.,11,2,3,1,2.,2.6393428561277688e-004,1.5437519550323486e-001,-2.2604019939899445e-001,0,2,7,0,10,6,-1.,7,2,10,2,3.,5.4196250857785344e-005,-2.8408589959144592e-001,1.2521779537200928e-001,0,3,20,12,4,6,-1.,22,12,2,3,2.,20,15,2,3,2.,-6.9367061369121075e-003,4.2877939343452454e-001,-6.5932586789131165e-002,0,3,1,12,4,6,-1.,1,12,2,3,2.,3,15,2,3,2.,-6.9427280686795712e-003,4.7249019145965576e-001,-7.1486473083496094e-002,0,2,11,10,12,3,-1.,11,11,12,1,3.,5.5062561295926571e-003,3.3114258199930191e-002,-7.6667702198028564e-001,0,2,0,7,1,10,-1.,0,12,1,5,2.,1.6204440034925938e-003,-1.1487250030040741e-001,2.3542539775371552e-001,0,2,23,7,2,10,-1.,23,12,2,5,2.,-1.9016009755432606e-003,2.0602910220623016e-001,-1.3353340327739716e-001,0,2,0,7,2,10,-1.,0,12,2,5,2.,-3.1080169137567282e-003,2.9334270954132080e-001,-1.5519270300865173e-001,0,2,22,3,2,3,-1.,22,3,1,3,2.,2.5391200324520469e-005,-1.6706739366054535e-001,8.8196061551570892e-002,0,2,1,3,2,3,-1.,2,3,1,3,2.,6.0073379427194595e-004,1.3103710114955902e-001,-2.3356419801712036e-001,1,2,22,1,2,2,-1.,22,1,2,1,2.,1.8550510285422206e-003,3.6863099783658981e-002,-4.8561948537826538e-001,0,2,0,0,8,8,-1.,2,0,4,8,2.,1.4426410198211670e-002,-1.0693179816007614e-001,3.0212250351905823e-001,0,2,24,3,1,6,-1.,24,5,1,2,3.,7.1379961445927620e-004,6.6108718514442444e-002,-3.4755659103393555e-001,0,2,0,1,1,9,-1.,0,4,1,3,3.,7.4721040436998010e-004,9.3699723482131958e-002,-2.9426920413970947e-001,0,3,13,5,2,10,-1.,14,5,1,5,2.,13,10,1,5,2.,-2.7122199535369873e-003,2.5431159138679504e-001,-1.0037600249052048e-001,0,2,1,0,3,3,-1.,2,1,1,1,9.,1.3803270412608981e-003,7.2880066931247711e-002,-3.4946250915527344e-001,0,2,24,3,1,8,-1.,24,7,1,4,2.,-5.0929130520671606e-004,1.5379770100116730e-001,-1.0336030274629593e-001,0,2,6,5,11,3,-1.,6,6,11,1,3.,5.4643009789288044e-003,3.4406248480081558e-002,-7.4866658449172974e-001,0,3,15,10,2,6,-1.,16,10,1,3,2.,15,13,1,3,2.,-1.5927649801596999e-003,2.9663398861885071e-001,-1.0934740304946899e-001,0,2,5,24,12,1,-1.,9,24,4,1,3.,1.4028839766979218e-002,3.9743378758430481e-002,-6.6694360971450806e-001,0,2,5,17,15,1,-1.,10,17,5,1,3.,2.7329521253705025e-004,-3.1862759590148926e-001,8.0982193350791931e-002,0,3,2,22,10,2,-1.,2,22,5,1,2.,7,23,5,1,2.,2.9240400181151927e-004,-1.2847329676151276e-001,2.0133419334888458e-001,-1.1262429952621460e+000,66,0,2,0,11,1,14,-1.,0,18,1,7,2.,8.0609228461980820e-003,5.8666739612817764e-002,-6.0697358846664429e-001,0,2,23,13,1,10,-1.,23,18,1,5,2.,-1.5501689631491899e-003,1.7384129762649536e-001,-4.8750329762697220e-002,0,2,1,13,1,10,-1.,1,18,1,5,2.,1.2496999697759748e-003,-1.4429050683975220e-001,3.3550319075584412e-001,0,2,23,3,1,20,-1.,23,8,1,10,2.,-4.8539130948483944e-003,1.8641370534896851e-001,-8.0262362957000732e-002,0,2,1,3,1,20,-1.,1,8,1,10,2.,4.7115739434957504e-003,-1.5105469524860382e-001,3.3180761337280273e-001,0,3,15,10,2,6,-1.,16,10,1,3,2.,15,13,1,3,2.,1.7103999853134155e-003,-8.0037981271743774e-002,2.3733739554882050e-001,0,2,2,3,10,18,-1.,7,3,5,18,2.,3.5812970250844955e-002,-3.5066539049148560e-001,9.4173669815063477e-002,0,2,5,3,15,18,-1.,5,9,15,6,3.,-1.4962269924581051e-002,2.0005929470062256e-001,-1.7400909960269928e-001,0,3,8,10,2,6,-1.,8,10,1,3,2.,9,13,1,3,2.,2.7363249100744724e-003,-9.7571246325969696e-002,3.8100358843803406e-001,0,3,20,5,4,8,-1.,22,5,2,4,2.,20,9,2,4,2.,7.6132859103381634e-003,-5.4448898881673813e-002,2.6586711406707764e-001,0,2,3,13,6,12,-1.,3,19,6,6,2.,-1.7225209623575211e-002,2.4964700639247894e-001,-1.2890140712261200e-001,0,2,12,17,3,6,-1.,12,20,3,3,2.,-3.5690729419002309e-005,-1.3402619957923889e-001,1.1350779980421066e-001,0,2,0,9,2,4,-1.,0,10,2,2,2.,5.5417261319234967e-004,7.9089917242527008e-002,-4.1190868616104126e-001,0,2,19,1,6,20,-1.,21,1,2,20,3.,5.3478521294891834e-003,-9.6101686358451843e-002,1.0175509750843048e-001,0,2,0,1,6,20,-1.,2,1,2,20,3.,7.4408110231161118e-003,-1.4914409816265106e-001,2.0994450151920319e-001,1,2,24,13,1,2,-1.,24,13,1,1,2.,-4.4247441110201180e-004,-1.4710159599781036e-001,9.5609091222286224e-002,1,2,1,13,2,1,-1.,1,13,1,1,2.,-4.5897331438027322e-004,-2.4636960029602051e-001,1.4493109285831451e-001,0,2,22,14,3,10,-1.,23,14,1,10,3.,1.4815660193562508e-002,1.3317920267581940e-002,-3.6167469620704651e-001,0,2,0,14,3,10,-1.,1,14,1,10,3.,2.4954939362942241e-005,-1.7566919326782227e-001,1.8010890483856201e-001,0,2,1,6,24,12,-1.,7,6,12,12,2.,4.9202781170606613e-002,-5.4308730363845825e-001,4.5933071523904800e-002,0,2,0,0,25,2,-1.,0,1,25,1,2.,5.7320448104292154e-004,-3.1106668710708618e-001,9.2909567058086395e-002,0,2,14,1,1,2,-1.,14,2,1,1,2.,2.3219949798658490e-004,7.1580216288566589e-002,-2.1587720513343811e-001,0,3,5,8,2,6,-1.,5,8,1,3,2.,6,11,1,3,2.,1.8309779698029160e-003,-9.6833512187004089e-002,3.0750191211700439e-001,1,2,19,22,2,1,-1.,19,22,1,1,2.,-1.4543849974870682e-003,-4.4618600606918335e-001,1.9532160833477974e-002,1,2,6,22,1,2,-1.,6,22,1,1,2.,-1.0844180360436440e-003,-6.3614559173583984e-001,4.4560171663761139e-002,0,2,14,1,1,2,-1.,14,2,1,1,2.,-1.0226800077361986e-004,-1.9193719327449799e-001,4.7297880053520203e-002,0,2,10,1,1,2,-1.,10,2,1,1,2.,3.4586260881042108e-005,1.6979439556598663e-001,-1.8605320155620575e-001,0,3,21,8,4,8,-1.,23,8,2,4,2.,21,12,2,4,2.,9.2637836933135986e-003,-6.7655943334102631e-002,4.3833279609680176e-001,0,3,0,8,4,8,-1.,0,8,2,4,2.,2,12,2,4,2.,9.4706043601036072e-003,-7.1250461041927338e-002,4.5724090933799744e-001,0,2,10,0,12,1,-1.,14,0,4,1,3.,1.3785040006041527e-002,3.3277660608291626e-002,-5.7532930374145508e-001,0,2,5,0,12,1,-1.,9,0,4,1,3.,1.1125699616968632e-002,6.2793843448162079e-002,-5.1709657907485962e-001,0,2,16,1,9,6,-1.,16,4,9,3,2.,1.3041479978710413e-003,-1.2779800593852997e-001,7.9484373331069946e-002,0,2,0,7,22,11,-1.,11,7,11,11,2.,-7.1009919047355652e-002,3.0970141291618347e-001,-1.0819730162620544e-001,0,2,5,2,15,6,-1.,10,4,5,2,9.,2.3755250498652458e-002,-2.1370269358158112e-001,1.5606459975242615e-001,0,3,9,2,2,18,-1.,9,2,1,9,2.,10,11,1,9,2.,4.2583458125591278e-003,-9.9179089069366455e-002,3.0855301022529602e-001,0,3,14,8,2,8,-1.,15,8,1,4,2.,14,12,1,4,2.,-2.9643340967595577e-003,3.2569590210914612e-001,-7.8191861510276794e-002,0,3,9,8,2,8,-1.,9,8,1,4,2.,10,12,1,4,2.,-2.6034889742732048e-003,3.4033051133155823e-001,-1.1317720264196396e-001,0,2,11,0,12,1,-1.,14,0,6,1,2.,1.0820809984579682e-003,-1.2465389817953110e-001,1.7554299533367157e-001,0,2,8,5,6,20,-1.,8,15,6,10,2.,5.7707168161869049e-002,-1.4793549478054047e-001,2.2689869999885559e-001,0,2,1,14,24,6,-1.,1,17,24,3,2.,4.4605578295886517e-003,1.7826089262962341e-001,-1.9520080089569092e-001,0,2,8,19,9,4,-1.,8,20,9,2,2.,-1.0610480094328523e-003,-3.7853738665580750e-001,8.2996547222137451e-002,0,2,14,21,1,2,-1.,14,22,1,1,2.,-3.4135719033656642e-005,-1.3351039588451385e-001,9.1380283236503601e-002,0,2,7,19,11,2,-1.,7,20,11,1,2.,1.6886419616639614e-003,7.7249847352504730e-002,-4.0701639652252197e-001,0,2,5,22,15,3,-1.,5,23,15,1,3.,3.5142740234732628e-003,-9.5770522952079773e-002,3.5281270742416382e-001,0,2,0,24,4,1,-1.,2,24,2,1,2.,2.3527929442934692e-005,-2.4744519591331482e-001,1.2634140253067017e-001,1,2,23,20,2,1,-1.,23,20,1,1,2.,-1.2832640204578638e-003,-6.1840718984603882e-001,2.2744800895452499e-002,0,3,9,9,2,8,-1.,9,9,1,4,2.,10,13,1,4,2.,1.7268180381506681e-003,-1.1576849967241287e-001,2.8422999382019043e-001,0,3,12,5,2,14,-1.,13,5,1,7,2.,12,12,1,7,2.,-2.8906469233334064e-003,1.6367140412330627e-001,-7.6792337000370026e-002,1,2,11,4,8,7,-1.,13,6,4,7,2.,-4.6315401792526245e-002,-7.4018758535385132e-001,4.0850590914487839e-002,0,2,24,23,1,2,-1.,24,24,1,1,2.,5.7796889450401068e-004,2.2493729367852211e-002,-6.3632518053054810e-001,0,2,0,23,1,2,-1.,0,24,1,1,2.,2.3074440832715482e-005,-1.6102099418640137e-001,1.9955199956893921e-001,1,2,23,20,2,1,-1.,23,20,1,1,2.,3.7793751107528806e-004,8.1283740699291229e-002,-1.3862569630146027e-001,1,2,2,20,1,2,-1.,2,20,1,1,2.,3.8195648812688887e-004,1.3359279930591583e-001,-2.4290829896926880e-001,0,2,16,1,8,6,-1.,16,4,8,3,2.,5.8516408316791058e-003,-1.1702840030193329e-001,1.1935660243034363e-001,0,2,0,23,24,1,-1.,8,23,8,1,3.,-6.6102901473641396e-003,4.5771899819374084e-001,-6.5725468099117279e-002,0,2,6,22,15,1,-1.,11,22,5,1,3.,1.5774279600009322e-003,-1.7396670579910278e-001,9.2294909060001373e-002,0,2,10,8,4,4,-1.,11,8,2,4,2.,-3.3255841117352247e-003,3.4227269887924194e-001,-9.2243947088718414e-002,0,2,4,9,18,3,-1.,4,10,18,1,3.,7.9220151528716087e-003,3.3358339220285416e-002,-9.0017801523208618e-001,0,2,6,12,2,1,-1.,7,12,1,1,2.,-1.5816869563423097e-004,2.8342399001121521e-001,-1.1450929939746857e-001,0,2,12,1,1,2,-1.,12,2,1,1,2.,3.4481548937037587e-005,1.6481010615825653e-001,-1.8168149888515472e-001,0,2,7,23,8,1,-1.,9,23,4,1,2.,2.0665400370489806e-005,-2.1995100378990173e-001,1.3373629748821259e-001,0,2,12,15,1,10,-1.,12,20,1,5,2.,-1.1080419644713402e-002,4.8246449232101440e-001,-6.6116742789745331e-002,0,2,1,17,11,8,-1.,1,19,11,4,2.,-1.7540570115670562e-003,-3.2195270061492920e-001,9.9385917186737061e-002,0,2,5,5,15,18,-1.,5,11,15,6,3.,-4.3996911495923996e-002,2.2565670311450958e-001,-1.2036679685115814e-001,0,2,1,1,8,6,-1.,1,4,8,3,2.,2.7804148849099874e-003,-1.7865939438343048e-001,1.6074460744857788e-001,0,2,24,3,1,10,-1.,24,8,1,5,2.,-6.3753691501915455e-003,-6.4006751775741577e-001,3.9249900728464127e-002,-1.1986110210418701e+000,74,0,2,2,10,6,2,-1.,4,10,2,2,3.,-5.5710230953991413e-003,3.6355179548263550e-001,-1.1429090052843094e-001,0,2,10,0,5,18,-1.,10,9,5,9,2.,-4.2533349245786667e-002,2.9995280504226685e-001,-1.4519970118999481e-001,0,2,4,5,17,20,-1.,4,15,17,10,2.,1.8632240593433380e-001,-1.7916500568389893e-001,3.0858990550041199e-001,0,2,10,3,6,9,-1.,10,6,6,3,3.,7.9207762610167265e-004,-2.2290030121803284e-001,1.5244559943675995e-001,0,2,7,0,11,18,-1.,7,9,11,9,2.,3.7020680308341980e-001,4.9322400242090225e-002,1.8848129882812500e+003,0,3,21,9,2,4,-1.,22,9,1,2,2.,21,11,1,2,2.,-1.4178600395098329e-003,3.7516620755195618e-001,-1.0939670354127884e-001,0,2,9,4,6,6,-1.,9,6,6,2,3.,9.9071431905031204e-003,1.1609580367803574e-001,-5.6801307201385498e-001,0,2,22,0,3,24,-1.,23,0,1,24,3.,1.2393960496410728e-003,-1.6311010718345642e-001,1.3559770584106445e-001,0,2,0,0,3,24,-1.,1,0,1,24,3.,1.0521570220589638e-003,-1.3373890519142151e-001,2.7264788746833801e-001,0,2,1,6,24,12,-1.,7,6,12,12,2.,4.4079091399908066e-002,-5.9660512208938599e-001,4.0246348828077316e-002,0,2,5,0,12,3,-1.,5,1,12,1,3.,2.9262369498610497e-003,-1.0696300119161606e-001,3.5247230529785156e-001,0,2,8,2,14,4,-1.,8,3,14,2,2.,-3.0069800559431314e-003,-4.8501899838447571e-001,6.5251968801021576e-002,0,2,0,4,1,21,-1.,0,11,1,7,3.,-1.1685189791023731e-002,-6.4442038536071777e-001,4.8711609095335007e-002,0,2,21,4,4,16,-1.,21,4,2,16,2.,1.9985749386250973e-003,-2.7951678633689880e-001,5.2013739943504333e-002,0,2,0,4,4,16,-1.,2,4,2,16,2.,2.6772189885377884e-003,-4.2468771338462830e-001,9.9645562469959259e-002,0,2,16,0,1,2,-1.,16,1,1,1,2.,6.8805456976406276e-005,1.2885080277919769e-001,-1.7418420314788818e-001,1,2,1,4,2,1,-1.,1,4,1,1,2.,-5.4919061949476600e-004,-2.4935460090637207e-001,1.2902539968490601e-001,0,2,23,3,1,14,-1.,23,10,1,7,2.,-3.6701560020446777e-003,1.4826999604701996e-001,-7.0212572813034058e-002,0,2,1,7,1,8,-1.,1,11,1,4,2.,-1.1337900068610907e-003,3.0599281191825867e-001,-1.4618510007858276e-001,0,2,23,8,2,10,-1.,23,13,2,5,2.,2.3506619036197662e-003,-8.9912116527557373e-002,1.4266289770603180e-001,0,2,0,8,2,10,-1.,0,13,2,5,2.,2.8336180839687586e-003,-1.5099850296974182e-001,2.5490570068359375e-001,1,2,23,22,2,1,-1.,23,22,1,1,2.,-1.2854239903390408e-003,-8.5387921333312988e-001,4.2431071400642395e-002,1,2,2,22,1,2,-1.,2,22,1,1,2.,4.2762109660543501e-004,1.0683789849281311e-001,-2.9406520724296570e-001,0,3,21,3,4,20,-1.,23,3,2,10,2.,21,13,2,10,2.,1.6246499493718147e-002,-6.3655123114585876e-002,2.4584819376468658e-001,0,3,0,3,4,20,-1.,0,3,2,10,2.,2,13,2,10,2.,1.7573300749063492e-002,-1.0204940289258957e-001,4.3239068984985352e-001,0,2,13,14,3,1,-1.,14,14,1,1,3.,3.9662708877585828e-004,-8.3214908838272095e-002,1.4920459687709808e-001,0,2,0,21,4,3,-1.,1,21,2,3,2.,-3.6139058647677302e-004,-2.6586309075355530e-001,1.2784530222415924e-001,0,2,21,10,4,2,-1.,21,10,2,2,2.,6.9180950522422791e-003,-7.3350369930267334e-002,2.7569389343261719e-001,0,2,0,10,4,2,-1.,2,10,2,2,2.,6.1709531582891941e-003,-1.0247000306844711e-001,3.1572508811950684e-001,0,2,23,8,2,12,-1.,23,8,1,12,2.,-7.1866158396005630e-004,2.6965659856796265e-001,-4.6928219497203827e-002,0,2,0,7,2,11,-1.,1,7,1,11,2.,-7.2996778180822730e-004,4.4648209214210510e-001,-9.4768881797790527e-002,0,2,13,0,12,24,-1.,17,8,4,8,9.,4.4531229138374329e-001,2.9124239459633827e-002,-5.9585410356521606e-001,1,2,4,21,1,2,-1.,4,21,1,1,2.,-1.4287939993664622e-003,-7.4422240257263184e-001,3.9988748729228973e-002,0,2,13,0,12,24,-1.,17,8,4,8,9.,1.2369489669799805e-001,-5.8587580919265747e-002,9.1279089450836182e-002,0,2,0,0,12,24,-1.,4,8,4,8,9.,4.2855501174926758e-001,4.5858480036258698e-002,-7.4231338500976563e-001,0,2,18,11,1,3,-1.,18,12,1,1,3.,2.5031169570866041e-005,-1.0736320167779922e-001,9.3773640692234039e-002,0,2,6,11,1,3,-1.,6,12,1,1,3.,4.9963229685090482e-005,-1.4796620607376099e-001,2.1811039745807648e-001,0,3,18,11,2,4,-1.,19,11,1,2,2.,18,13,1,2,2.,2.9644069727510214e-003,-4.4790871441364288e-002,5.7993519306182861e-001,0,3,5,11,2,4,-1.,5,11,1,2,2.,6,13,1,2,2.,1.5743350377306342e-003,-7.9150870442390442e-002,3.8991490006446838e-001,0,2,12,17,6,3,-1.,12,18,6,1,3.,6.0039688833057880e-003,2.3944819346070290e-002,-9.5635467767715454e-001,0,2,0,12,2,4,-1.,0,13,2,2,2.,4.2808058788068593e-004,7.5896047055721283e-002,-3.6652448773384094e-001,1,2,23,0,2,6,-1.,23,0,2,3,2.,1.1229339987039566e-002,2.3623889312148094e-002,-4.8159009218215942e-001,1,2,2,0,6,2,-1.,2,0,3,2,2.,-1.5405230224132538e-003,1.0571250319480896e-001,-2.9972699284553528e-001,0,2,15,0,8,1,-1.,17,0,4,1,2.,5.5489651858806610e-003,1.7742669209837914e-002,-4.7681280970573425e-001,0,2,2,0,8,1,-1.,4,0,4,1,2.,4.0579969063401222e-003,6.8737268447875977e-002,-4.6888938546180725e-001,0,2,12,10,11,3,-1.,12,11,11,1,3.,5.0152339972555637e-003,1.9214930012822151e-002,-7.2317951917648315e-001,0,3,8,10,2,6,-1.,8,10,1,3,2.,9,13,1,3,2.,1.7280939500778913e-003,-1.0325799882411957e-001,3.2534700632095337e-001,0,2,1,23,24,2,-1.,1,23,12,2,2.,-2.4781659245491028e-002,-3.1078928709030151e-001,8.6045600473880768e-002,0,3,8,8,2,12,-1.,8,8,1,6,2.,9,14,1,6,2.,-1.8893589731305838e-003,2.3782789707183838e-001,-1.3323649764060974e-001,0,2,7,13,11,3,-1.,7,14,11,1,3.,4.2236722074449062e-003,5.0405610352754593e-002,-6.6566771268844604e-001,1,2,11,0,2,4,-1.,11,0,2,2,2.,-1.4858880080282688e-002,6.0808688402175903e-001,-6.4919866621494293e-002,0,2,16,0,1,2,-1.,16,1,1,1,2.,1.7625730251893401e-003,-2.6388010010123253e-002,6.1008471250534058e-001,0,2,8,0,1,2,-1.,8,1,1,1,2.,6.5077590988948941e-005,1.8001219630241394e-001,-1.9105610251426697e-001,0,2,13,0,12,8,-1.,13,2,12,4,2.,-2.4088749196380377e-003,-2.3599469661712646e-001,7.4184507131576538e-002,0,2,3,6,16,2,-1.,7,6,8,2,2.,2.9149129986763000e-003,-2.8016430139541626e-001,1.2283849716186523e-001,1,2,13,12,1,12,-1.,9,16,1,4,3.,6.2007219530642033e-003,-1.2533469498157501e-001,1.3337619602680206e-001,0,2,4,0,12,1,-1.,7,0,6,1,2.,1.1466739699244499e-002,4.2434468865394592e-002,-7.6637887954711914e-001,0,3,3,2,20,16,-1.,13,2,10,8,2.,3,10,10,8,2.,-3.5191178321838379e-002,1.8971160054206848e-001,-1.2784330546855927e-001,0,2,1,1,6,24,-1.,1,9,6,8,3.,4.5229779061628506e-005,-2.0386409759521484e-001,1.9156099855899811e-001,0,2,23,23,2,2,-1.,23,23,1,2,2.,3.5897540510632098e-004,7.3452822864055634e-002,-2.2871449589729309e-001,0,2,0,23,2,2,-1.,1,23,1,2,2.,2.1426780222100206e-005,-2.3904530704021454e-001,1.7463220655918121e-001,0,2,21,14,4,8,-1.,21,14,2,8,2.,5.4916929453611374e-002,5.7207080535590649e-003,-8.3265262842178345e-001,0,2,0,14,4,8,-1.,2,14,2,8,2.,-1.6181350219994783e-003,4.8578798770904541e-001,-7.9697981476783752e-002,0,2,22,3,3,11,-1.,23,3,1,11,3.,1.8090730300173163e-003,-5.5137149989604950e-002,1.8998570740222931e-001,0,3,6,9,2,10,-1.,6,9,1,5,2.,7,14,1,5,2.,-3.4946738742291927e-004,1.9685539603233337e-001,-1.5550769865512848e-001,0,2,8,19,11,6,-1.,8,21,11,2,3.,2.9834950692020357e-004,-2.1016369760036469e-001,9.0075306594371796e-002,0,2,9,20,6,2,-1.,9,21,6,1,2.,1.4741290360689163e-003,5.4677028208971024e-002,-5.2060151100158691e-001,0,2,24,17,1,8,-1.,24,21,1,4,2.,6.1138661112636328e-004,-1.1104019731283188e-001,1.8061339855194092e-001,0,2,10,4,2,4,-1.,10,6,2,2,2.,-2.2484369765152223e-005,1.8097889423370361e-001,-1.7276780307292938e-001,0,2,24,17,1,8,-1.,24,21,1,4,2.,1.8067440250888467e-003,7.0003516972064972e-002,-3.5405930876731873e-001,0,2,0,17,1,8,-1.,0,21,1,4,2.,4.2339949868619442e-004,-1.6226269304752350e-001,2.4823880195617676e-001,0,3,16,8,2,8,-1.,17,8,1,4,2.,16,12,1,4,2.,4.7990549355745316e-003,-5.3161401301622391e-002,4.2028531432151794e-001,0,3,7,8,2,8,-1.,7,8,1,4,2.,8,12,1,4,2.,1.0556719498708844e-003,-1.3919970393180847e-001,2.5979140400886536e-001,0,2,7,6,12,12,-1.,7,9,12,6,2.,4.1018951684236526e-002,-5.3697388619184494e-002,4.8265969753265381e-001];
    module.handopen = new Float32Array(classifier);
    module.handopen.tilted = true;
})(objectdetect);


window.loadCamera =function() {
    var timesFist = 0;
    var isOpenDone = false;
    var isClosedDone = false;
    //var smoother = new Smoother([0,0], [0, 0], 0),
        var canvas = document.getElementById('canvas'),
        context = canvas.getContext('2d'),
        video = document.getElementById('video'),
        detector;
        var openDetector;

    try {
        compatibility.getUserMedia({ video: true }, function (stream) {
            try {
                video.src = compatibility.URL.createObjectURL(stream);
            } catch (error) {
                video.src = stream;
            }
            compatibility.requestAnimationFrame(play);
        }, function (error) {
            alert("WebRTC not available123");
        });
    } catch (error) {
        alert(error);
    }

    var fist_poses = [];

    var fist_pos_old, angle = [0, 0];
    var open_pos_old;

    function play() {
        compatibility.requestAnimationFrame(play);
        try {
            if (video.paused) video.play();
        }
        catch (e) {
        }
        // Draw video overlay:
        //canvas.width = ~~(100 * video.videoWidth / video.videoHeight);
        //canvas.height = 100;
        context.drawImage(video, 0, 0, canvas.clientWidth, canvas.clientHeight);

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {

            // Prepare the detector once the video dimensions are known:
            if (!detector) {
                var width = ~~(140 * video.videoWidth / video.videoHeight);
                var height = 140;
                detector = new objectdetect.detector(width, height, 1.1, objectdetect.handfist);
                openDetector = new objectdetect.detector(width, height, 1.1, objectdetect.handopen);
            }

            // Smooth rotation of the 3D object:
            //angle = smoother.smooth(angle);
            

            // Perform the actual detection:
            if (isOpenDone && !isClosedDone) {
                var coords = detector.detect(video, 3);

                if (coords[0]) {
                    var coord = coords[0];

                    // Rescale coordinates from detector to video coordinate space:
                    coord[0] *= video.videoWidth / detector.canvas.width;
                    coord[1] *= video.videoHeight / detector.canvas.height;
                    coord[2] *= video.videoWidth / detector.canvas.width;
                    coord[3] *= video.videoHeight / detector.canvas.height;

                    var fist_pos = [coord[0] + coord[2] / 2, coord[1] + coord[3] / 2];

                    if (fist_pos_old) {
                        var dx = (fist_pos[0] - fist_pos_old[0]) / video.videoWidth,
                            dy = (fist_pos[1] - fist_pos_old[1]) / video.videoHeight;

                        //if (dx * dx + dy * dy < 0.2) {
                        //    angle[0] += 5.0 * dx;
                        //    angle[1] += 5.0 * dy;
                        //}
                        fist_pos_old = fist_pos;
                    } else if (coord[4] > 2) {
                        fist_pos_old = fist_pos;
                    }
                    //$(".doneButton").css("display", "block");
                    //document.getElementsByClassName("doneButton")[0].removeAttribute('class');
                    document.getElementById('lblMessage').textContent = "CLOSED";
                    document.getElementById('lblMessage').className = "closed-color";
                    document.getElementsByClassName("doneButton")[0].className =
  document.getElementsByClassName("doneButton")[0].className
    .replace(new RegExp('(?:^|\\s)' + 'doneButton' + '(?:\\s|$)'), ' ');
                    isClosedDone = true;
                    //document.getElementById("canvas").setAttribute('style', 'display:none !important;');
                    // Draw coordinates on video overlay:
                    //context.beginPath();
                    //context.lineWidth = '10';
                    //context.fillStyle = 'blue';
                    //context.fillRect(
                    //    coord[0] / video.videoWidth * canvas.clientWidth,
                    //    coord[1] / video.videoHeight * canvas.clientHeight,
                    //    coord[2] / video.videoWidth * canvas.clientWidth,
                    //    coord[3] / video.videoHeight * canvas.clientHeight);
                    //context.stroke();
                } else fist_pos_old = null;
            }
            if (!isOpenDone) {
                var openCoords = openDetector.detect(video, 3);
                if (openCoords[0]) {
                    var coord = openCoords[0];

                    // Rescale coordinates from detector to video coordinate space:
                    coord[0] *= video.videoWidth / openDetector.canvas.width;
                    coord[1] *= video.videoHeight / openDetector.canvas.height;
                    coord[2] *= video.videoWidth / openDetector.canvas.width;
                    coord[3] *= video.videoHeight / openDetector.canvas.height;

                    var fist_pos = [openCoords[0] + openCoords[2] / 2, openCoords[1] + openCoords[3] / 2];

                    if (open_pos_old) {
                        var dx = (open_pos_old[0] - open_pos_old[0]) / video.videoWidth,
                            dy = (open_pos_old[1] - open_pos_old[1]) / video.videoHeight;

                        //if (dx * dx + dy * dy < 0.2) {
                        //    angle[0] += 5.0 * dx;
                        //    angle[1] += 5.0 * dy;
                        //}
                        open_pos_old = fist_pos;
                    } else if (coord[4] > 2) {
                        open_pos_old = fist_pos;
                    }
                    isOpenDone = true;
                    document.getElementById('lblMessage').className = "open-color";
                    document.getElementById('lblMessage').textContent = "OPEN";
                    // Draw coordinates on video overlay:
                    context.beginPath();
                    context.lineWidth = '10';
                    context.fillStyle = 'red';
                    context.fillRect(
                        coord[0] / video.videoWidth * canvas.clientWidth,
                        coord[1] / video.videoHeight * canvas.clientHeight,
                        coord[2] / video.videoWidth * canvas.clientWidth,
                        coord[3] / video.videoHeight * canvas.clientHeight);
                    context.stroke();
                } else fist_pos_old = null;
            }
        }
    }
};
