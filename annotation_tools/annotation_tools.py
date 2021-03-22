"""
Flask web server.
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import datetime
import json
import os
import random

from flask import Flask, render_template, jsonify, request, send_from_directory, abort
from flask_pymongo import PyMongo
from bson import json_util

from annotation_tools import default_config as cfg
from annotation_tools.utils import COLOR_LIST

import numpy as np
import base64
import pickle
from PIL import Image

JRDB_PATH = '../jrdb_coco'

def im2json(im):
    """Convert a Numpy array to JSON string"""
    imdata = pickle.dumps(im)
    jstr = json.dumps({"image": base64.b64encode(imdata).decode('ascii')})
    return jstr


app = Flask(__name__)
#app.config.from_object('annotation_tools.default_config')
app.config['MONGO_URI'] = 'mongodb://'+cfg.MONGO_HOST+':'+str(cfg.MONGO_PORT)+'/'+cfg.MONGO_DBNAME

if 'VAT_CONFIG' in os.environ:
  app.config.from_envvar('VAT_CONFIG')
mongo = PyMongo(app)

def get_db():
  """ Return a handle to the database
  """
  with app.app_context():
    db = mongo.db
    return db

############### Dataset Utilities ###############

@app.route('/')
def home():
  return render_template('layout.html')

@app.route('/images/<path:path>')
def send_js(path):
  print("PATH: ", path)
  return send_from_directory('../'+JRDB_PATH+'/images', path)


@app.route('/edit_image/<image_id>')
def edit_image(image_id):
  """ Edit a single image.
  """

  image = mongo.db.image.find_one_or_404({'id' : image_id})
  annotations = list(mongo.db.annotation.find({'image_id' : image_id}))
  categories = list(mongo.db.category.find())

  # image = np.full((480, 640, 3), [0, 0, 255], dtype=np.uint8) 
  # annotations = [{
  #   "keypoints": [(0, 0),
  #     (5, 5),
  #     (100, 20)
  #   ],
  #   "category_id": [
  #     0, 1, 2
  #   ],
  #   "keypoints_style": [
  #     "#ff0000",
  #     "#ff0000",
  #     "#ff0000"
  #   ]
  # }]
  # categories = [0]

  # image = im2json(image) 
  image = json_util.dumps(image)
  annotations = json_util.dumps(annotations)
  categories = json_util.dumps(categories)

  # if request.is_xhr:
  print("BEST: ", request.accept_mimetypes.best)
  if request.accept_mimetypes.accept_json:
    print("getting json")
    # Return just the data
    return jsonify({
      'image' : json.loads(image),
      'annotations' : json.loads(annotations),
      'categories' : json.loads(categories)
    })
  else:
    print("Rendering page")
    # Render a webpage to edit the annotations for this image
    return render_template('edit_image.html', image=image, annotations=annotations, categories=categories)


@app.route('/jrdb/people/<scene_id>')
def jrdb_people(scene_id):
  scene_path = os.path.join(JRDB_PATH, 'annotations', scene_id)
  annot_path = os.path.join(scene_path, 'annotations_mmpose.json')
  if not os.path.isdir(scene_path) or not os.path.isfile(annot_path):
    abort(404)

  print('loading annotations in scene', scene_id)
  with open(annot_path) as f:
    dataset = json.load(f)
    annotations = dataset['annotations']
    people = sorted(list(set([anno['track_id'] for anno in annotations])))
    print('... done')

  return jsonify({
    'people' : people
  })



@app.route('/jrdb/scene/<scene_id>')
def edit_jrdb(scene_id):
  """ Edit a single image.
  """

  


  scene_path = os.path.join(JRDB_PATH, 'annotations', scene_id)
  annot_path = os.path.join(scene_path, 'annotations_mmpose.json')
  if not os.path.isdir(scene_path) or not os.path.isfile(annot_path):
    abort(404)

  print('loading annotations in scene', scene_id)
  with open(annot_path) as f:
    dataset = json.load(f)
    print('... done')

    categories = dataset['categories']
    if len(categories) > 0:
        # Ensure that the category ids are strings
      for cat in categories:
        # cat['id'] = str(cat['id'])

        # Add specific colors to the keypoints
        if 'keypoints' in cat and 'keypoints_style' not in cat:
          keypoints_style = []
          for k in range(len(cat['keypoints'])):
            keypoints_style.append(COLOR_LIST[k % len(COLOR_LIST)])
          cat['keypoints_style'] = keypoints_style

    url_with_prefix = "/images/"+scene_id+"/"

    images = dataset['images']
    for image in images:
      # image['id'] = str(image['id'])
      # image['license'] = str(image['license']) if 'license' in image else ''

      # If loading JRDB dataset (with set prefix), use file_name as url
      if 'url' not in image and url_with_prefix is not None:
        image['url'] = url_with_prefix + image['file_name']

      # If loading the actual COCO dataset, then remap `coco_url` to `url`
      # elif 'url' not in image and 'coco_url' in image:
        # image['url'] = image['coco_url']

      # Add a blank rights holder if it is not present
      # if 'rights_holder' not in image:
        # image['rights_holder'] = ''
    annotations = dataset['annotations']
    if 'person' in request.args:
      track_id = request.args['person']
      print('track id: ', track_id)
      annotations = [a for a in annotations if a['track_id'] == track_id]
    # image_id_to_w_h = {image['id'] : (float(image['width']), float(image['height']))
                         # for image in images}

    for anno in annotations:
      # anno['id'] = str(anno['id'])
      # anno['image_id'] = str(anno['image_id'])
      # anno['category_id'] = str(anno['category_id'])
      # image_width, image_height = image_id_to_w_h[anno['image_id']]
      # x, y, w, h = anno['bbox']
      # anno['bbox'] = [x / image_width, y / image_height, w / image_width, h / image_height]
      if 'keypoints' in anno:

        # needs conversion from [[x,y,v],[x,y,v]...] to [x,y,v,x,y,v]
        if len(anno['keypoints']) == len(categories[0]['keypoints']):
          new_keypoints = []
          for pidx in range(0, len(anno['keypoints'])):
            x, y, v = anno['keypoints'][pidx]
            # new_keypoints += [x / image_width, y / image_height, v]
            new_keypoints += [x, y, v]
          anno['keypoints'] = new_keypoints

        # for pidx in range(0, len(anno['keypoints']), 3):
        #   x, y = anno['keypoints'][pidx:pidx+2]
        #   anno['keypoints'][pidx:pidx+2] = [x / image_width, y / image_height]
          
    # sort annotations by image id
    image_id_list = sorted(list(set([anno['image_id'] for anno in annotations])))
    print('last id: ', image_id_list[-1])
    annotations_list = [[] for im_id in range(0, image_id_list[-1]+1)]
    for anno in annotations:
      annotations_list[anno['image_id']].append(anno)


  print('... and done processing')

  return jsonify({
    'image_list' : images,#json.loads(image_list),
    'annotations_list' : annotations_list, #json.loads(annotations_list),
    'categories' : categories #json.loads(categories)
  })
        

  # keypoint = -1
  # person_idx = 0
  # if 'keypoint' in request.args:
    # keypoint = int(request.args['keypoint'])
  # if 'person' in request.args:
    # person_idx = int(request.args['person'])
 


  image_list = []
  annotations_list = []

  image_ids = list(range(1, 10))
  for image_id in image_ids:
    print("got image ", image_id)
    image = mongo.db.image.find_one_or_404({'id' : str(image_id)})
    annotations = list(mongo.db.annotation.find({'image_id' : str(image_id)}))
    # if len(annotations) > 0:
      # annotations = annotations[person_idx]
      # if keypoint != -1:
        # annotations['keypoints'] = annotations['keypoints'][keypoint*3:keypoint*3 + 3]
    image_list.append(image)
    annotations_list.append(annotations)
    
  categories = list(mongo.db.category.find())

  # image = np.full((480, 640, 3), [0, 0, 255], dtype=np.uint8) 
  # annotations = [{
  #   "keypoints": [(0, 0),
  #     (5, 5),
  #     (100, 20)
  #   ],
  #   "category_id": [
  #     0, 1, 2
  #   ],
  #   "keypoints_style": [
  #     "#ff0000",
  #     "#ff0000",
  #     "#ff0000"
  #   ]
  # }]
  # categories = [0]


  image_list = json_util.dumps(image_list)
  annotations_list = json_util.dumps(annotations_list)
  categories = json_util.dumps(categories)

  return jsonify({
    'image_list' : json.loads(image_list),
    'annotations_list' : json.loads(annotations_list),
    'categories' : json.loads(categories)
  })


@app.route('/edit_task/')
def edit_task():
  """ Edit a group of images.
  """

  if 'image_ids' in request.args:

    image_ids = request.args['image_ids'].split(',')

  else:

    start=0
    if 'start' in request.args:
      start = int(request.args['start'])
    end=None
    if 'end' in request.args:
      end = int(request.args['end'])

    # Find annotations and their accompanying images for this category
    if 'category_id' in request.args:
      category_id = request.args['category_id']
      annos = mongo.db.annotation.find({ "category_id" : category_id}, projection={'image_id' : True, '_id' : False})#.sort([('image_id', 1)])
      image_ids = list(set([anno['image_id'] for anno in annos]))
      image_ids.sort()

    # Else just grab all of the images.
    else:
      images = mongo.db.image.find(projection={'id' : True, '_id' : False}).sort([('id', 1)])
      image_ids = [image['id'] for image in images]

    if end is None:
      image_ids = image_ids[start:]
    else:
      image_ids = image_ids[start:end]

    if 'randomize' in request.args:
      if request.args['randomize'] >= 1:
        random.shuffle(image_ids)

  categories = list(mongo.db.category.find(projection={'_id' : False}))

  return render_template('edit_task.html',
    task_id=1,
    image_ids=image_ids,
    categories=categories,
  )

@app.route('/annotations/save', methods=['POST'])
def save_annotations():
  """ Save the annotations. This will overwrite annotations.
  """
  annotations = json_util.loads(json.dumps(request.json['annotations']))

  for annotation in annotations:
    # Is this an existing annotation?
    if '_id' in annotation:
      if 'deleted' in annotation and annotation['deleted']:
        mongo.db.annotation.delete_one({'_id' : annotation['_id']})
      else:
        result = mongo.db.annotation.replace_one({'_id' : annotation['_id']}, annotation)
    else:
      if 'deleted' in annotation and annotation['deleted']:
        pass # this annotation was created and then deleted.
      else:
        # This is a new annotation
        # The client should have created an id for this new annotation
        # Upsert the new annotation so that we create it if its new, or replace it if (e.g) the
        # user hit the save button twice, so the _id field was never seen by the client.
        assert 'id' in annotation
        mongo.db.annotation.replace_one({'id' : annotation['id']}, annotation, upsert=True)

        # if 'id' not in annotation:
        #   insert_res = mongo.db.annotation.insert_one(annotation, bypass_document_validation=True)
        #   anno_id =  insert_res.inserted_id
        #   mongo.db.annotation.update_one({'_id' : anno_id}, {'$set' : {'id' : str(anno_id)}})
        # else:
        #   insert_res = mongo.db.insert_one(annotation)

  return ""

@app.route('/annotations/savemany', methods=['POST'])
def save_annotations_many():
  """ Save the annotations. This will overwrite annotations.
  """
  print("saving many annotations")
  annotations_list = json_util.loads(json.dumps(request.json['annotations_list']))
  scene_id = 'bytes'

  scene_path = os.path.join(JRDB_PATH, 'annotations', scene_id)
  annot_path = os.path.join(scene_path, 'annotations_mmpose.json')
  print(scene_path)
  print(annot_path)
  if not os.path.isdir(scene_path):
    abort(404)

  annots_concat = []
  for anno in annotations_list:
    annots_concat += anno

  with open(annot_path) as f:
    dataset = json.load(f)
    dataset['annotations'] = annots_concat

  with open(annot_path, 'w') as outfile:
    json.dump(dataset, outfile, indent=4)

  # for annotations in annotations_list:
  #   for annotation in annotations:
  #     # Is this an existing annotation?
  #     if '_id' in annotation:
  #       if 'deleted' in annotation and annotation['deleted']:
  #         mongo.db.annotation.delete_one({'_id' : annotation['_id']})
  #       else:
  #         result = mongo.db.annotation.replace_one({'_id' : annotation['_id']}, annotation)
  #     else:
  #       if 'deleted' in annotation and annotation['deleted']:
  #         pass # this annotation was created and then deleted.
  #       else:
  #         # This is a new annotation
  #         # The client should have created an id for this new annotation
  #         # Upsert the new annotation so that we create it if its new, or replace it if (e.g) the
  #         # user hit the save button twice, so the _id field was never seen by the client.
  #         assert 'id' in annotation
  #         mongo.db.annotation.replace_one({'id' : annotation['id']}, annotation, upsert=True)

  #         # if 'id' not in annotation:
  #         #   insert_res = mongo.db.annotation.insert_one(annotation, bypass_document_validation=True)
  #         #   anno_id =  insert_res.inserted_id
  #         #   mongo.db.annotation.update_one({'_id' : anno_id}, {'$set' : {'id' : str(anno_id)}})
  #         # else:
  #         #   insert_res = mongo.db.insert_one(annotation)


  return ""


#################################################

################## BBox Tasks ###################

@app.route('/bbox_task/<task_id>')
def bbox_task(task_id):
  """ Get the list of images for a bounding box task and return them along
  with the instructions for the task to the user.
  """

  bbox_task = mongo.db.bbox_task.find_one_or_404({'id' : task_id})
  task_id = str(bbox_task['id'])
  tasks = []
  for image_id in bbox_task['image_ids']:
    image = mongo.db.image.find_one_or_404({'id' : image_id}, projection={'_id' : False})
    tasks.append({
      'image' : image,
      'annotations' : []
    })

  category_id = bbox_task['category_id']
  categories = [mongo.db.category.find_one_or_404({'id' : category_id}, projection={'_id' : False})]
  #categories = json.loads(json_util.dumps(categories))

  task_instructions_id = bbox_task['instructions_id']
  task_instructions = mongo.db.bbox_task_instructions.find_one_or_404({'id' : task_instructions_id}, projection={'_id' : False})

  return render_template('bbox_task.html',
    task_id=task_id,
    task_data=tasks,
    categories=categories,
    mturk=True,
    task_instructions=task_instructions
  )

@app.route('/bbox_task/save', methods=['POST'])
def bbox_task_save():
  """ Save the results of a bounding box task.
  """

  task_result = json_util.loads(json.dumps(request.json))

  task_result['date'] = str(datetime.datetime.now())

  insert_res = mongo.db.bbox_task_result.insert_one(task_result, bypass_document_validation=True)

  return ""

#################################################
