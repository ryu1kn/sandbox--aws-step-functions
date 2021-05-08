// Example copied from https://github.com/aws-samples/aws-cdk-examples/tree/master/typescript/stepfunctions-job-poller

import cdk = require('@aws-cdk/core')
import sfn = require('@aws-cdk/aws-stepfunctions')
import {LogLevel} from '@aws-cdk/aws-stepfunctions'
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs'
import {EvaluateExpression} from '@aws-cdk/aws-stepfunctions-tasks'
import {Duration} from '@aws-cdk/core'

export class JobPollerStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
        super(scope, id, props)

        const doSomeJob = new EvaluateExpression(this, 'Do some job', {
            expression: 'Math.floor(Math.random()*3)',
            resultPath: '$.statusCode'
        })
        const wait = new sfn.Wait(this, 'Wait', {
            time: sfn.WaitTime.duration(Duration.seconds(2))
        })
        const getStatus = new EvaluateExpression(this, 'Check status code', {
            expression: '$.statusCode === 0 ? "SUCCEEDED" : ($.statusCode === 1 ? "FAILED" : "UNKNOWN")',
            resultPath: '$.status'
        })
        const isComplete = new sfn.Choice(this, 'Job Completed?')
        const concludeWithFailure = new sfn.Fail(this, 'Failed', {
            cause: 'Undesirable result',
            error: 'FAILED with an odd statusCode'
        })
        const concludeWithSuccess = new EvaluateExpression(this, 'Succeeded', {
            expression: '"All passed!"',
            resultPath: '$.finalStatus'
        })

        const chain = sfn.Chain
            .start(doSomeJob)
            .next(getStatus)
            .next(isComplete
                .when(sfn.Condition.stringEquals('$.status', 'FAILED'), concludeWithFailure)
                .when(sfn.Condition.stringEquals('$.status', 'SUCCEEDED'), concludeWithSuccess)
                .otherwise(wait.next(doSomeJob)))

        new sfn.StateMachine(this, 'StateMachine', {
            definition: chain,
            timeout: cdk.Duration.seconds(30),
            logs: {
                destination: new LogGroup(this, 'LogGroup', {retention: RetentionDays.ONE_WEEK}),
                level: LogLevel.ALL
            }
        })
    }
}

const app = new cdk.App()
const stackProps = {env: {region: 'ap-southeast-2'}}

new JobPollerStack(app, 'aws-stepfunctions-integ', stackProps)

app.synth()
