var SplineLoopHelper = require('threejs-spline-loop-helper');
var _ = require('lodash');


var worldCameraPosition = new THREE.Vector3(),
	objectVector = new THREE.Vector3();

var planeNormal = new THREE.Vector3(0, 0, 1);
var planeConstant = 0;
var plane = new THREE.Plane(planeNormal.clone(), planeConstant);
function rayCollision(camera, targetObject, planeMesh) {
	worldCameraPosition.copy(camera.position);
	camera.parent.localToWorld(worldCameraPosition);
	objectVector.copy(targetObject.position);
	targetObject.parent.localToWorld(objectVector);
	objectVector.sub( worldCameraPosition ).normalize();
	// var raycaster = new THREE.Raycaster( worldCameraPosition, objectVector );
	// return raycaster.intersectObjects( objects );
	plane.set(planeNormal, planeConstant);
	plane.applyMatrix4(planeMesh.matrixWorld);
	var ray = new THREE.Ray(worldCameraPosition, objectVector);
	// var yeah = ray.isIntersectionPlane(plane);
	return ray.intersectPlane(plane);
};


var crossSectionHelperPlaneMesh = new THREE.Mesh(
	new THREE.PlaneGeometry(4, 4, 4, 4),
	new THREE.MeshBasicMaterial({
		color: 0xcfcfcf,
		side: THREE.DoubleSide,
		wireframe: true
	})
)

function reattach(object, newParent) {
	newParent.updateMatrix();
	newParent.updateMatrixWorld();
	object.applyMatrix( object.parent.matrixWorld );
	var matrixWorldInverse = new THREE.Matrix4();
	matrixWorldInverse.getInverse( newParent.matrixWorld );
	object.applyMatrix( matrixWorldInverse );
	newParent.add(object);
}

function SplineLoopPrismHelper(splineLoopPrism, options) {
	THREE.Object3D.call(this);
	this.splineLoopPrism = splineLoopPrism;

	var color = 0x9f7f5f;
	options = _.merge({
		handleRadius: .25,
		color: color,
		alwaysOnTop: true,
		splineHelper: {
			color: color,
			handleRadius: .15
		}
	}, options || {});

	this.handleMaterial = options.handleMaterial || new THREE.MeshBasicMaterial({
		depthTest: !options.alwaysOnTop,
		transparent: true,
		color: options.color,
		blending: THREE.AdditiveBlending
	});

	var splineLoops = [
		splineLoopPrism.splineLoopInnerTop,
		splineLoopPrism.splineLoopInnerBottom,
		splineLoopPrism.splineLoopOuterTop,
		splineLoopPrism.splineLoopOuterBottom
	];

	var _this = this;
	splineLoops.forEach(function(splineLoop) {
		var helper = new SplineLoopHelper(splineLoop, options.splineHelper);
		_this.add(helper);
		splineLoop.helper = helper;
	})

	var totalHandles = splineLoopPrism.splineLoopInnerTop.points.length;
	var handleGeometry = new THREE.SphereGeometry(options.handleRadius);

	var handles = this.handles = [];
	var handlesOrSubhandles = this.handlesOrSubhandles = [];
	var activeHandles = this.activeHandles = [];
	for(var i = 0; i < totalHandles; i++) {
		var handle = new THREE.Mesh(handleGeometry, this.handleMaterial);
		handle.renderDepth = options.alwaysOnTop ? 1 : undefined;
		handles.push(handle);
		handlesOrSubhandles.push(handle);
		handle.position.copy(splineLoopPrism.sample(i/totalHandles, .5, .5));
		handle.subHandles = [];
		this.add(handle);
		handle.updateMatrixWorld();
		handle.activate = function() {
			if(this.active) return;
			activeHandles.push(this);
			this.active = true;
			this.add(crossSectionHelperPlaneMesh);
			this.crossSectionHelperPlaneMesh = crossSectionHelperPlaneMesh;
			this.update();
			var _this = this;
			this.subHandles.forEach(function(subHandle) {
				reattach(subHandle, _this.crossSectionHelperPlaneMesh);
			});
		}.bind(handle);
		handle.deactivate = function() {
			if(!this.active) return;
			activeHandles.splice(activeHandles.indexOf(this), 1);
			this.active = false;
			this.remove(this.crossSectionHelperPlaneMesh);
			this.crossSectionHelperPlaneMesh = null;
			var _this = this;
			this.subHandles.forEach(function(subHandle) {
				reattach(subHandle, subHandle.helper);
			});
		}.bind(handle);
		handle.update = function() {
			var index = handles.indexOf(this);
			var prevHandle = handles[(index-1+totalHandles) % totalHandles];
			var nextHandle = handles[(index+1) % totalHandles];
			// this.crossSectionHelperPlaneMesh.position.copy(prevHandle.position);
			this.crossSectionHelperPlaneMesh.position.copy(this.position);
			this.crossSectionHelperPlaneMesh.lookAt(nextHandle.position);
			var tempQuaternion = this.crossSectionHelperPlaneMesh.quaternion.clone();
			this.crossSectionHelperPlaneMesh.position.copy(prevHandle.position);
			this.crossSectionHelperPlaneMesh.lookAt(this.position);
			this.crossSectionHelperPlaneMesh.quaternion.slerp(tempQuaternion, .5);
			this.crossSectionHelperPlaneMesh.position.set(0, 0, 0);
			this.crossSectionHelperPlaneMesh.updateMatrixWorld();
			var _this = this;
			this.subHandles.forEach(function(subHandle) {
				subHandle.point.copy(_this.crossSectionHelperPlaneMesh.localToWorld(subHandle.position.clone()));
			})
			splineLoops.forEach(function(splineLoop) {
				splineLoop.updateCache();
				splineLoop.helper.update();
			});
		}.bind(handle);
		splineLoops.forEach(function(splineLoop) {
			var subHandle = splineLoop.helper.handles[i];
			subHandle.helper = splineLoop.helper;
			subHandle.superHandle = handle;
			subHandle.activate = function(camera) {
				if(this.active) return;
				activeHandles.push(this);
				this.active = true;
				this.superHandle.activate();
				this.superHandle.update();
				this.superHandle.deactivate();
				this.superHandle.add(crossSectionHelperPlaneMesh);
				this.superHandle.crossSectionHelperPlaneMesh = crossSectionHelperPlaneMesh;
				this.camera = camera;
			}.bind(subHandle);
			subHandle.deactivate = function() {
				if(!this.active) return;
				activeHandles.splice(activeHandles.indexOf(this), 1);
				this.active = false;
				this.superHandle.remove(crossSectionHelperPlaneMesh);
				this.superHandle.crossSectionHelperPlaneMesh = null;
				delete this.camera;
			}.bind(subHandle);
			subHandle.update = function() {
				var collision = rayCollision(this.camera, this, this.superHandle.crossSectionHelperPlaneMesh);
				if(collision) {
					this.position.copy(collision);
				}
				this.point.copy(this.position);
				splineLoop.updateCache();
				splineLoop.helper.update();
			}.bind(subHandle);
			handle.subHandles.push(subHandle);
			handlesOrSubhandles.push(subHandle);
		});
	}
}

SplineLoopPrismHelper.prototype = Object.create(THREE.Object3D.prototype);

SplineLoopPrismHelper.prototype.update = function() {
	for (var i = 0; i < this.activeHandles.length; i++) {
		this.activeHandles[i].update();
	};
}
module.exports = SplineLoopPrismHelper;