import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as March1StProducerVpc from '../lib/march1st-producer-vpc-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new March1StProducerVpc.March1StProducerVpcStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
