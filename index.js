
var DecisionTask = require('./lib/DecisionTask');

module.exports = function (workflowFunction) {

  var AWS = require('aws-sdk');
  var swf = new AWS.SWF();

  return function(event, context) {

    var d = new DecisionTask(event, context);

    console.log('Running lambda workflow function');

    try {
      workflowFunction(d);
    }
    catch(ex) {
      console.log(ex, ex.stack); // an error occurred

      // TODO: here, we got an error in the worfklow decider, we should fail the workflow

      //context.fail(ex.message);

      swf.respondDecisionTaskCompleted({
        taskToken: event.taskToken,
        decisions: [{
           "decisionType": "FailWorkflowExecution",
           "failWorkflowExecutionDecisionAttributes": {
              "reason": "Execution error: "+ex.message,
              "details": ex.stack
           }
        }]
      }, function (err) {
         if (err) { console.error(err); return; }
         console.log("Workflow marked as failed ! (decision task)");
         context.succeed({err: "Workflow marked as failed ! "+ex.message});
      });

      return;
    }

    var params = {
      taskToken: event.taskToken,
      decisions: d.decisions
    };

    // When a child workflow is executed, we receive a new decision task after the event
    // StartChildWorkflowExecutionInitiated is added, which means that the child workflow
    // was successful to start. But on this situation, we may want to just wait for the
    // child workflow to finish, so no decisions must be made for now.
    // It's the decider responsibility to choose when he must fail the workflow, so if no decisions
    // have been added, just send a DecisionTaskCompleted with no decisions
    if(!d.decisions) {
      console.log("No decision sent and no decisions scheduled !");
      swf.respondDecisionTaskCompleted(params, function(err, data) {
        if (err) {
          console.log('Error in respondDecisionTaskCompleted');
          console.log(err, err.stack); // an error occurred
          context.fail(err);
          return;
        }

        console.log('respondDecisionTaskCompleted results : ', data);
        context.succeed(data);
      });
      return;
    }

    console.log('Workflow function ok, sending '+d.decisions.length+' decisions...');
    console.log(JSON.stringify(params));

    swf.respondDecisionTaskCompleted(params, function(err, data) {
      if (err) {
        console.log('Error in respondDecisionTaskCompleted');
        console.log(err, err.stack); // an error occurred
        context.fail(err);
        return;
      }

      console.log('respondDecisionTaskCompleted results : ', data);
      context.succeed(data);
    });


  };

};
