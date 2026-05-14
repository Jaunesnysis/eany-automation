export function printReport(report) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  REPORT');
  console.log('═══════════════════════════════════════════');

  if (report.added.length > 0) {
    console.log('\n✅ Added to cart:');
    report.added.forEach(i => {
      const note = i.capped ? ` (capped from ${i.needed} — stock limit)` : '';
      console.log(`   • ${i.ean}`);
      console.log(`     ${i.title}`);
      console.log(`     Quantity: ${i.added}${note}`);
    });
  }

  if (report.skipped.length > 0) {
    console.log('\n⏭️  Skipped:');
    report.skipped.forEach(i => {
      console.log(`   • ${i.ean} — ${i.reason}`);
    });
  }

  if (report.added.length === 0 && report.skipped.length === 0) {
    console.log('\n  No items processed.');
  }

  console.log('\n🛒 Cart is ready for purchaser review.');
  console.log('   Browser left open — do NOT close until reviewed.\n');
}
