const { runMonolithTests } = require('./monolith.test');
const { runMicroservicesTests } = require('./microservices.test');

async function main() {
  const target = (process.argv[2] || 'all').toLowerCase();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║               SEPM AUTOMATED TEST SUITE RUNNER                ║');
  console.log('║   Evaluating Sprint Velocity: Monolith vs. Microservices      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  let monolithMetrics = null;
  let microservicesMetrics = null;

  if (target === 'monolith' || target === 'all') {
    const startMono = Date.now();
    const monoRes = await runMonolithTests();
    const durationSec = ((Date.now() - startMono) / 1000).toFixed(3);
    monolithMetrics = { ...monoRes, durationSec };
  }

  if (target === 'microservices' || target === 'all') {
    const startMicro = Date.now();
    const microRes = await runMicroservicesTests();
    const durationSec = ((Date.now() - startMicro) / 1000).toFixed(3);
    microservicesMetrics = { ...microRes, durationSec };
  }

  console.log('\n===============================================================');
  console.log('                TEST EXECUTION SUMMARY METRICS                 ');
  console.log('===============================================================');

  if (monolithMetrics) {
    console.log(`📦 Modular Monolith Suite:`);
    console.log(`   - Tests Passed:    ${monolithMetrics.passed} / ${monolithMetrics.total}`);
    console.log(`   - Execution Time:  ${monolithMetrics.durationSec}s`);
  }

  if (microservicesMetrics) {
    console.log(`🌐 Microservices Cluster Suite:`);
    console.log(`   - Tests Passed:    ${microservicesMetrics.passed} / ${microservicesMetrics.total}`);
    console.log(`   - Execution Time:  ${microservicesMetrics.durationSec}s`);
  }

  if (monolithMetrics && microservicesMetrics) {
    const diff = (microservicesMetrics.durationSec - monolithMetrics.durationSec).toFixed(3);
    console.log(`\n📊 Testing Overhead Delta:`);
    console.log(`   - Microservices test duration was ${diff}s longer (${((microservicesMetrics.durationSec / monolithMetrics.durationSec) * 100).toFixed(1)}% of Monolith runtime) due to TCP sockets and network serialization.`);
  }

  const allPassed =
    (!monolithMetrics || monolithMetrics.failed === 0) &&
    (!microservicesMetrics || microservicesMetrics.failed === 0);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
