<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/booking_product_interactions.php';
function checkBooking(bool $state,string $why): void {
    if(!$state)throw new RuntimeException($why);
}
checkBooking(kareta_booking_intervals_overlap(100,160,130,200),'overlap rejected');
checkBooking(!kareta_booking_intervals_overlap(100,160,160,200),'adjacent end incorrectly overlaps');
checkBooking(!kareta_booking_intervals_overlap(160,200,100,160),'adjacent start incorrectly overlaps');
checkBooking(!kareta_booking_intervals_overlap(100,130,140,200),'nonoverlap blocked');
checkBooking(kareta_booking_intervals_overlap(100,240,140,160),'nested conflict missed');
$tz=new DateTimeZone('Asia/Almaty');
$date=new DateTimeImmutable('2026-10-20 00:00:00',$tz);
$now=new DateTimeImmutable('2026-10-19 10:00:00',$tz);
$busyFrom=$date->setTime(10,0)->getTimestamp();
$slots=kareta_booking_candidate_slots($date,$now,[[$busyFrom,$busyFrom+120*60]],120);
$times=array_column($slots,'value');
checkBooking(!in_array('09:00',$times,true),'09:00 overlaps 10:00-12:00');
checkBooking(!in_array('11:30',$times,true),'11:30 overlaps 10:00-12:00');
checkBooking(in_array('12:00',$times,true),'12:00 should be available after appointment');
$next=kareta_booking_candidate_slots($date,$date->setTime(23,0),[],120);
checkBooking(count($next)===0,'past slot generated');
$longBusy=[[$date->setTime(10,0)->getTimestamp(),$date->setTime(13,0)->getTimestamp()]];
checkBooking(!in_array('12:30',array_column(kareta_booking_candidate_slots($date,$now,$longBusy,30),'value'),true),'long appointment ignored');
$api=file_get_contents(dirname(__DIR__).'/api/booking_product_interactions.php');
$db=file_get_contents(dirname(__DIR__).'/api/db.php');
$ui=file_get_contents(dirname(__DIR__).'/js/next/pages/details.js');
checkBooking(str_contains($api,"'error'=>'master_required'")&&str_contains($api,"'error'=>'service_required'"),'missing explicit master/offer gates');
checkBooking(str_contains($api,'booking_slots_unavailable'),'DB errors must not invent empty calendar');
checkBooking(str_contains($db,'booking_slot_conflict')&&str_contains($db,'FOR UPDATE'),'atomic order booking guard missing');
checkBooking(str_contains($db,'estimated_duration_min=?'),'confirmed booking duration must persist');
checkBooking(str_contains($ui,'data-book-service-option')&&str_contains($ui,'slotAllowed'),'client must explicitly select offer and recheck');
echo "BOOKING_RECOVERY: PASS interval/adjacency/past/long-duration and cross-layer guards (mock/no DB)\n";
