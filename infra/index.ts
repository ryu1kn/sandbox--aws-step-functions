import {App, Duration, Stack, StackProps} from '@aws-cdk/core'
import * as sfn from '@aws-cdk/aws-stepfunctions'
import {EvaluateExpression} from '@aws-cdk/aws-stepfunctions-tasks'
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs'

enum JobStatus {
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    UNKNOWN = 'UNKNOWN'
}

export class JobStack extends Stack {
    constructor(scope: App, id: string, props: StackProps) {
        super(scope, id, props)

        const doSomeJob = new EvaluateExpression(this, 'Do some job', {
            expression: 'Math.floor(Math.random()*3)',
            resultPath: '$.statusCode'
        })
        const wait = new sfn.Wait(this, 'Wait', {
            time: sfn.WaitTime.duration(Duration.seconds(2))
        })
        const getJobStatus = new EvaluateExpression(this, 'Check status code', {
            expression: `$.statusCode === 0 ? "${JobStatus.SUCCEEDED}" : ($.statusCode === 1 ? "${JobStatus.FAILED}" : "${JobStatus.UNKNOWN}")`,
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
            .next(getJobStatus)
            .next(isComplete
                .when(sfn.Condition.stringEquals('$.status', JobStatus.FAILED), concludeWithFailure)
                .when(sfn.Condition.stringEquals('$.status', JobStatus.SUCCEEDED), concludeWithSuccess)
                .otherwise(wait.next(doSomeJob)))

        new sfn.StateMachine(this, 'StateMachine', {
            definition: chain,
            timeout: Duration.seconds(30),
            logs: {
                destination: new LogGroup(this, 'LogGroup', {retention: RetentionDays.ONE_WEEK}),
                level: sfn.LogLevel.ALL
            }
        })
    }
}

const app = new App()
const stackProps = {env: {region: 'ap-southeast-2'}}

new JobStack(app, 'sandbox--step-functions', stackProps)

app.synth()
