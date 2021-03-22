
class JRDBAnnotator {

  constructor(leafletClass) {

    this.LOAD_ALL_DATA = true;
    
    this.frameIdx = 0;
    this.personIdx = 0;
    this.trackList = [];
    this.trackIdx = 0;
    this.keypointIdx = -1;
    this.selectedKeypointIdx = -1;

    this.image = new Image;
    this.image.src = "http://localhost:8008/images/bytes/000003.jpg";

    this.interpolating = false;
    this.interpIdx = -1;
    this.interp_gt_list = [];

    // Bind methods
    this.leafletModifedCallback = this.leafletModifedCallback.bind(this);
    this.getNewScenePeople = this.getNewScenePeople.bind(this);
    this.getNewSceneData = this.getNewSceneData.bind(this);
    this.setSceneData = this.setSceneData.bind(this);
    this.fillHTMLKeypointsList = this.fillHTMLKeypointsList.bind(this);
    this.setSelectedKeypointIdx = this.setSelectedKeypointIdx.bind(this);

    // Initialize annotator
    this.leaflet = new LeafletAnnotation(leafletClass);
    this.leaflet.create();

    this.leaflet.setKeypointModifiedCallback(this.leafletModifedCallback);

    const self = this;
    this.refreshImage(this.image.src, function() {
      self.getNewScenePeople(function() {
        self.getNewSceneData(self.setSceneData, function() {
          console.log("Error getting scene data");
        });
      }, function() {
        console.log("Error getting scene people");
      })
      
    });

    // var image = new Image();
    // image.src = "https://i.imgur.com/zkqRw1q.jpeg"
    // image.src = "http://localhost:8008/images/bytes-cafe-2019-02-07_0/000003.jpg";
    // this.leaflet.setImage(image);


    
  }

  // Callback for when leaflet 
  leafletModifedCallback(modifiedIdx) {
    let new_keypoints = this.leaflet.getAnnotations()[0].keypoints;
    // console.log("Old keypoints: " + this.data.annotations_list[this.frameIdx][this.personIdx].keypoints);
    // console.log("new keypoints: " + new_keypoints);

    if (this.interpolating) {
      // console.log("modified idx " + modifiedIdx);
      // console.log('modified pt: ' + new_keypoints)
      if (this.interpIdx == -1) {
        this.interpIdx = modifiedIdx;
      }
      if (this.interpIdx == modifiedIdx) {
        this.addInterpolationPoint([new_keypoints[modifiedIdx*3], new_keypoints[modifiedIdx*3 + 1]]);
      }
    }
  }

  beginInterpolation() {
    console.log("interpolating...");
    this.interpolating = true;
    this.interpIdx = -1;
    this.interp_gt_list = [];
  }

  addInterpolationPoint(pt) {
    console.log("Adding point " + pt);
    // First, see if we have this index already
    let idx = this.interp_gt_list.findIndex(el => el[0] == this.frameIdx);
    console.log("found match at idx " + idx);
    if (idx != -1) {
      this.interp_gt_list[idx][1] = pt[0];
      this.interp_gt_list[idx][2] = pt[1];
    } else {
      this.interp_gt_list.push([this.frameIdx, pt[0], pt[1]]);
    }
    this.fillInterpolationList();
  }

  removeInterpolationPoint(idx) {
    this.interp_gt_list.splice(idx, 1);
    this.fillInterpolationList();
  }

  fillInterpolationList() {
    console.log("filling interp list " + this.interp_gt_list);
    var self = this;
    let color = this.data.categories[0].keypoints_style[this.interpIdx];
    $("#keypoint_list").html("");

    for (var i = 0; i < this.interp_gt_list.length; i++) {
      let key = this.data.categories[0].keypoints[i];
      let frame = this.interp_gt_list[i][0];
      let id = "interp_gt_id_"+i;
      $("#keypoint_list").append(`
        <div class="row keypoint">
          <div class="keypoint_color_container">
            <div class="keypoint_color" style="background-color:`+color+`;"></div>
          </div>
          <div class="keypoint_desc">
            <p>Frame `+frame+`</p>
          </div>
          <div class="button">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-sm btn-outline-secondary" id="interp_view_`+id+`">
                <i class="fas fa-eye"></i>
                View
              </button>
              <button class="btn btn-sm btn-outline-secondary" id="interp_rm_`+id+`">
                <i class="far fa-trash-alt"></i>
                Remove
              </button>
            </div>
          </div>
        </div>
      `);

      $("#interp_view_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[2]);
        self.frameIdx = frame;
        self.refreshAll();
      });

      $("#interp_rm_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[2]);
        self.removeInterpolationPoint(idx);
      });
    }
  }

  performInterpolation() {
    if (this.interp_gt_list.length >= 2) {
      // Sort list by index value
      this.interp_gt_list.sort(function (a, b) {
        return a[0] - b[0];
      });

      let startIdx = this.interp_gt_list[0][0];
      let endIdx = this.interp_gt_list[this.interp_gt_list.length-1][0];
      console.log("start idx: " + startIdx);
      console.log("end idx: " + endIdx);

      // "before" points from interpolation list
      var points = this.interp_gt_list.map(function(a) {
        return [a[1], a[2]];
      });

      console.log("points: " + points);

      var path = Smooth(points, {
        method: Smooth.METHOD_CUBIC, 
        // clip: Smooth.CLIP_PERIODIC, 
        cubicTension: Smooth.CUBIC_TENSION_CATMULL_ROM,
        scaleTo: [startIdx, endIdx]
      });

      for (var frame = startIdx; frame < endIdx; frame++) {

        // see if the person exists at this frame
        let track_id = this.trackList[this.trackIdx];
        let match_idx = this.data.annotations_list[frame].findIndex(a => a['track_id'] == track_id);
        console.log('match idx: ' + match_idx);

        if (match_idx > 0) {

          let pt = path(frame);
          // console.log('point ' + frame + ': ' + pt);
          let keyIdx = this.interpIdx;
          this.data.annotations_list[frame][match_idx].keypoints[keyIdx*3] = pt[0];
          this.data.annotations_list[frame][match_idx].keypoints[keyIdx*3+1] = pt[1];
        }
      }
    }

    console.log("interpolation done! refreshing...");
    this.refreshAll();
  }

  setKeypointIdx(idx) {

    console.log("Setting new keypoint with id "+idx);
    this.keypointIdx = idx;
    let self = this;
    this.getNewSceneData(function(data) {
      self.setSceneData(data);
    }, function() {
      console.log("Error getting scene data");
    });
  }

  setSelectedKeypointIdx(idx) {
    console.log("Selecting new keypoint with id "+idx);
    this.selectedKeypointIdx = idx;
    let name = this.data.categories[0].keypoints[idx];
    let color = this.data.categories[0].keypoints_style[idx];
    $('#selected_keypoint_color').css("background-color", color);
    $('#selected_keypoint_name').html(name);
  }

  applyKalmanFilter(idx) {
    console.log("applying kalman filter to id "+idx);

    let track_id = this.trackList[this.trackIdx];
    // let personIdx = this.data.annotations_list[this.frameIdx].find(a => a['track_id'] == track_id);

    var kalmanFilterX = new KalmanFilter({R: 0.001, Q: 0.002});
    var kalmanFilterY = new KalmanFilter({R: 0.001, Q: 0.002});

    var old_points = [];
    var new_points = [];

    let num_frames = this.data.annotations_list.length;
    for (var i = 0; i < num_frames; i++) {

      let person = this.data.annotations_list[i].find(a => a['track_id'] == track_id);

      let kp_x = person.keypoints[idx*3];
      let kp_y = person.keypoints[idx*3 + 1];

      let new_x = kalmanFilterX.filter(kp_x);
      let new_y = kalmanFilterY.filter(kp_y);

      old_points.push(kp_x);
      new_points.push(new_x);

      person.keypoints[idx*3] = new_x;
      person.keypoints[idx*3 + 1] = new_y;
    }

    console.log('Done filtering ' + num_frames + ' frames');
    console.log(old_points);
    console.log(new_points);
    

    // var dataConstantKalman = noisyDataConstant.map(function(v) {
    //   return kalmanFilter.filter(v);
    // });
  }

  isolateKeypiont(idx) {

  }

  getNewScenePeople(onSuccess, onFail) {
    let url =  'http://localhost:8008/jrdb/people/bytes';
    var self = this;
    $.ajax({
      url: url,
      method: 'GET'
    }).done(function(data){
      console.log(data);
      self.trackList = data.people;
      onSuccess();
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }


  performSave(onSuccess, onFail){
    console.log("saving annotations...");
    $.ajax({
      url : "/annotations/savemany",
      method : 'POST',
      data : JSON.stringify({'annotations_list' : this.data.annotations_list}),
      contentType: 'application/json'
    }).done(function(){
      console.log("saved annotations");
      onSuccess();
    }).fail(function(){
      onFail();
    });
  }

  getNewSceneData(onSuccess, onFail) {
    let url =  'http://localhost:8008/jrdb/scene/bytes?keypoint=' + this.keypointIdx;
    if (!this.LOAD_ALL_DATA) {
      url += '&person=' + this.trackList[this.trackIdx];
    }

    $.ajax({
      url: url,
      method: 'GET'
    }).done(function(data){
      console.log(data);
      onSuccess(data);
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }

  setSceneData(data) {
    this.data = data;
    this.refreshAll();
    this.fillHTMLKeypointsList();
    console.log(data.categories);
  }

  fillHTMLKeypointsList() {
    var self = this;
    $("#keypoint_list").html("");

    for (var i = 0; i < this.data.categories[0].keypoints.length; i++) {
      let key = this.data.categories[0].keypoints[i];
      let color = this.data.categories[0].keypoints_style[i];
      let id = "keypoints_id_"+i;
      $("#keypoint_list").append(`
        <div class="row keypoint">
          <button class="btn btn-sm btn-outline-secondary select_button" id="select_`+id+`">
            <i class="far fa-hand-pointer"></i>
          </button>
          <div class="keypoint_color_container">
            <div class="keypoint_color" style="background-color:`+color+`;"></div>
          </div>
          <div class="keypoint_desc">
            <p>`+key+`</p>
          </div>
          <div class="button">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-sm btn-outline-secondary" id="zoom_`+id+`">
                <i class="fas fa-compress"></i> 
                Zoom
              </button>
              <button class="btn btn-sm btn-outline-secondary" id="isolate_`+id+`">
                <i class="far fa-dot-circle"></i>
                Kalman
              </button>
            </div>
          </div>
        </div>
      `);

      $("#select_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        self.setSelectedKeypointIdx(idx);
      });

      $("#isolate_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        self.applyKalmanFilter(idx);
      });

      $("#zoom_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        console.log("focusing on marker " + idx);
        self.focusOnMarker(idx);
      });
    }
  }

  getDataForImage(id, onSuccess, onFail) {
    $.ajax({
      url : 'http://localhost:8008/edit_image/'+id,
      method : 'GET'
    }).done(function(data){
      onSuccess(data);
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }

  // getNewAnnotations(id) {
  //   let leaflet = this.leaflet;
  //   this.getDataForImage(id, function(data) {
  //     console.log("SUCCESS");
  //     console.log(data);
  //     leaflet.setAnnotations(data);
  //   }, function() {
  //     console.log("Error getting data for image id " + id);
  //   })
  // }


  getImagePath() {
    // console.log(this.data.image_list[this.frameIdx].file_name);
    return "http://localhost:8008/images/bytes/" +
            this.data.image_list[this.frameIdx].file_name;
            // String(this.currentImageId).padStart(6, '0') + ".jpg";
  }

  refreshImage(imagePath, callback=null) {
    // console.log("Loading image with path " + imagePath);
    var newImg = new Image;
    let image = this.image;
    let leaflet = this.leaflet;
    newImg.onload = function() {
      image.src = newImg.src;
      // redraw();
      leaflet.setImage(image);
      if (callback != null) callback();
    }
    newImg.src = imagePath;
  }

  refreshAll(callback=null) {
    this.leaflet.clearAnnotations();
    this.refreshImage(this.getImagePath(), callback);
    var leafletAnnots = this.data.annotations_list[this.frameIdx];
    if (leafletAnnots.length > 1) {
      let track_id = this.trackList[this.trackIdx];
      let match = leafletAnnots.find(a => a['track_id'] == track_id);
      if (match == null) {
        leafletAnnots = []  
      } else {
        leafletAnnots = [match]
      }
      console.log('tarck id: ' + track_id);
      
    }
    this.leaflet.setAnnotations(leafletAnnots,
                                 this.data.categories, this.keypointIdx);
    $("#frameNum").html(String(this.frameIdx));
    $("#person_id").html(this.trackList[this.trackIdx]);
  }

  prev_image(delta=1, callback=null) {
    this.frameIdx -= delta;
    if (this.frameIdx < 0) {
      this.frameIdx = 0;
    }
    this.refreshAll(callback);
  }
  
  next_image(delta=1, callback=null) {
    // console.log(callback);
    this.frameIdx += delta;
    if (this.frameIdx > this.data.annotations_list.length-1) {
      this.frameIdx = this.data.annotations_list.length-1;
    }
    this.refreshAll(callback);
  }

  togglePlaying(doneCallback) {
    if (this.playing) {
      this.playing = false;
    } else {
      this.playing = true;
      this.play(this, doneCallback);
    }
  }

  play(self=this, doneCallback) {
    // console.log('callback');
    // console.log(self.play);
    if (this.playing && self.frameIdx < self.data.annotations_list.length-1) {
      self.next_image(1, function() {
        setTimeout(function() {
          self.play(self, doneCallback);
        }, 10);
      });
    } else {
      this.playing = false;
      doneCallback();
    }
  }

  pause() {
    this.playing = false;
  }

  rewind() {
    this.playing = false;
    this.frameIdx = 0;
    this.refreshAll();
  }

  next_person() {
    // if (this.personIdx < this.data.annotations_list[0].length-2) {
    //   this.personIdx++;
    //   this.refreshAll();
    // }

    if (this.trackIdx < this.trackList.length-2) {
      this.trackIdx++;
      if (this.LOAD_ALL_DATA) {
        this.refreshAll();        
      } else {
        this.getNewSceneData(this.setSceneData, function() {
          console.log("Error getting scene data");
        });
      }
    }
  }

  prev_person() {
    // if (this.personIdx > 0) {
    //   this.personIdx--;
    //   this.refreshAll();
    // }
    if (this.trackIdx > 0) {
      this.trackIdx--;
      if (this.LOAD_ALL_DATA) {
        this.refreshAll();        
      } else {
        this.getNewSceneData(this.setSceneData, function() {
          console.log("Error getting scene data");
        });
      }
    }
  }

  focusOnAnnotation() {
    this.leaflet.handleAnnotationFocus(0);
  }

  focusOnMarker(markerIdx) {
    this.leaflet.centerLeafletMapOnMarker(markerIdx);
  }
}