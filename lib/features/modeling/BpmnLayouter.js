import inherits from 'inherits';

import {
  assign
} from 'min-dash';

import BaseLayouter from 'diagram-js/lib/layout/BaseLayouter';

import {
  repairConnection
} from 'diagram-js/lib/layout/ManhattanLayout';

import {
  getMid,
  getOrientation
} from 'diagram-js/lib/layout/LayoutUtil';

import {
  isExpanded
} from '../../util/DiUtil';

import { is } from '../../util/ModelUtil';


export default function BpmnLayouter() {}

inherits(BpmnLayouter, BaseLayouter);


BpmnLayouter.prototype.layoutConnection = function(connection, hints) {
  hints = hints || {};

  var source = connection.source,
      target = connection.target,
      waypoints = connection.waypoints,
      start = hints.connectionStart,
      end = hints.connectionEnd;

  var manhattanOptions,
      updatedWaypoints;

  if (!start) {
    start = getConnectionDocking(waypoints && waypoints[0], source);
  }

  if (!end) {
    end = getConnectionDocking(waypoints && waypoints[waypoints.length - 1], target);
  }

  // TODO(nikku): support vertical modeling
  // and invert preferredLayouts accordingly

  if (is(connection, 'bpmn:Association') ||
      is(connection, 'bpmn:DataAssociation')) {

    if (waypoints && !isCompensationAssociation(connection)) {
      return [].concat([ start ], waypoints.slice(1, -1), [ end ]);
    }
  }

  // manhattan layout sequence / message flows
  if (is(connection, 'bpmn:MessageFlow')) {
    manhattanOptions = {
      preferredLayouts: [ 'v:v' ]
    };

    if (is(target, 'bpmn:Participant')) {
      manhattanOptions = {
        preferredLayouts: [ 'straight', 'v:v' ]
      };
    }

    if (isExpandedSubProcess(target)) {
      manhattanOptions = {
        preferredLayouts: [ 'straight', 'v:v' ]
      };
    }

    if (isExpandedSubProcess(source) && is(target, 'bpmn:FlowNode')) {
      manhattanOptions = {
        preferredLayouts: [ 'straight', 'v:v' ],
        preserveDocking: isExpandedSubProcess(target) ? 'source' : 'target'
      };
    }

    if (is(source, 'bpmn:Participant') && is(target, 'bpmn:FlowNode')) {
      manhattanOptions = {
        preferredLayouts: [ 'straight', 'v:v' ],
        preserveDocking: 'target'
      };
    }

    if (is(target, 'bpmn:Event')) {
      manhattanOptions = {
        preferredLayouts: [ 'v:v' ]
      };
    }
  } else


  // layout all connection between flow elements h:h,
  //
  // except for
  //
  // (1) outgoing of BoundaryEvents -> layout h:v or v:h based on attach orientation
  // (2) incoming / outgoing of Gateway -> v:h (outgoing), h:v (incoming)
  //
  if (is(connection, 'bpmn:SequenceFlow') ||
      isCompensationAssociation(connection)) {

    if (is(source, 'bpmn:BoundaryEvent')) {

      var orientation,
          attachOrientation = getAttachOrientation(source),
          preferredLayouts;

      var isLoop = source.host === target;

      switch (attachOrientation) {
      case 'top':
      case 'top-right':
      case 'top-left':
        orientation = getOrientation(getMid(target), getMid(source), target.width / 2);

        if (orientation === 'top') {
          preferredLayouts = [ 'v:v' ];
        } else {
          preferredLayouts = (isLoop || /bottom/.test(orientation)) ? [ 't:v' ] : [ 't:h' ];
        }

        break;
      case 'right':
        orientation = getOrientation(getMid(target), getMid(source), target.height / 2);

        if (orientation === 'right') {
          preferredLayouts = [ 'h:h' ];
        } else {
          preferredLayouts = (isLoop || /left/.test(orientation)) ? [ 'r:h' ] : [ 'r:v' ];
        }

        break;
      case 'bottom':
      case 'bottom-right':
      case 'bottom-left':
        orientation = getOrientation(getMid(target), getMid(source), target.width / 2);

        if (orientation === 'bottom') {
          preferredLayouts = [ 'v:v' ];
        } else {
          preferredLayouts = (isLoop || /top/.test(orientation)) ? [ 'b:v' ] : [ 'b:h' ];
        }

        break;
      case 'left':
        orientation = getOrientation(getMid(target), getMid(source), target.height / 2);

        if (orientation === 'left') {
          preferredLayouts = [ 'h:h' ];
        } else {
          preferredLayouts = (isLoop || /right/.test(orientation)) ? [ 'l:h' ] : [ 'l:v' ];
        }

        break;
      }

      manhattanOptions = {
        preferredLayouts: preferredLayouts
      };

    } else

    if (is(source, 'bpmn:Gateway')) {

      manhattanOptions = {
        preferredLayouts: [ 'v:h' ]
      };
    } else

    if (is(target, 'bpmn:Gateway')) {

      manhattanOptions = {
        preferredLayouts: [ 'h:v' ]
      };
    }

    // apply horizontal love <3
    else {
      manhattanOptions = {
        preferredLayouts: [ 'h:h' ]
      };
    }
  }

  if (manhattanOptions) {

    manhattanOptions = assign(manhattanOptions, hints);

    updatedWaypoints =
      repairConnection(
        source, target,
        start, end,
        waypoints,
        manhattanOptions);
  }

  return updatedWaypoints || [ start, end ];
};


function getAttachOrientation(attachedElement) {

  var hostElement = attachedElement.host,
      padding = -10;

  return getOrientation(getMid(attachedElement), hostElement, padding);
}


function getConnectionDocking(point, shape) {
  return point ? (point.original || point) : getMid(shape);
}

function isCompensationAssociation(connection) {

  var source = connection.source,
      target = connection.target;

  return is(target, 'bpmn:Activity') &&
         is(source, 'bpmn:BoundaryEvent') &&
         target.businessObject.isForCompensation;
}


function isExpandedSubProcess(element) {
  return is(element, 'bpmn:SubProcess') && isExpanded(element);
}