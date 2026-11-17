#!/usr/bin/env bash
# Daily-report lottery entries must behave the same in both reporting services.
# The lottery code and its tests are kept identical apart from the vendor name; this script fails when they drift.
# Usage (from the reporting-service folder): scripts/check-lottery-sync.sh
set -euo pipefail
cd "$(dirname "$0")/.."

V=verifone-reporting-service/src
G=gilbarco-reporting-service/src
FILES=(
  main/java/com/handsoffretail/reporting/@/lottery/LotteryField.java
  main/java/com/handsoffretail/reporting/@/lottery/LotteryErrorCode.java
  main/java/com/handsoffretail/reporting/@/lottery/LotteryDayEntry.java
  main/java/com/handsoffretail/reporting/@/lottery/LotteryEntryRequest.java
  main/java/com/handsoffretail/reporting/@/lottery/LotteryEntryRepository.java
  main/java/com/handsoffretail/reporting/@/lottery/LotteryEntryService.java
  main/java/com/handsoffretail/reporting/@/lottery/impl/JdbcLotteryEntryRepository.java
  main/java/com/handsoffretail/reporting/@/lottery/impl/LotteryEntryServiceImpl.java
  main/java/com/handsoffretail/reporting/@/controller/LotteryEntryController.java
  test/java/com/handsoffretail/reporting/@/lottery/LotteryEntryServiceImplTest.java
  test/java/com/handsoffretail/reporting/@/lottery/JdbcLotteryEntryRepositoryIT.java
  test/java/com/handsoffretail/reporting/@/controller/LotteryEntryControllerTest.java
)
normalize() {
  sed -e 's/com\.handsoffretail\.reporting\.\(verifone\|gilbarco\)/com.handsoffretail.reporting.VENDOR/g' \
      -e 's/PosVendor\.\(VERIFONE\|GILBARCO\)/PosVendor.VENDOR/g' \
      -e 's/\(verifone\|gilbarco\)WriteDataSource/VENDORWriteDataSource/g' "$1"
}
status=0
for f in "${FILES[@]}"; do
  v="$V/${f//@/verifone}"; g="$G/${f//@/gilbarco}"
  if ! diff -u <(normalize "$v") <(normalize "$g") >/dev/null; then
    echo "OUT OF SYNC: $f"; diff -u <(normalize "$v") <(normalize "$g") || true; status=1
  fi
done
[ $status -eq 0 ] && echo "lottery code in sync (${#FILES[@]} files)"
exit $status
