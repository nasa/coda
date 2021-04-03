<?php
$t = microtime(true);
$micro = sprintf("%06d",($t - floor($t)) * 1000000);
$d = new DateTime( date('Y-m-d H:i:s.'.$micro, $t) );
$d->setTimezone(new DateTimeZone('GMT'));

header('Content-Type: application/json');
echo "{ \"serverTime\": \"" . $d->format("Y-m-d\TH:i:s.u\Z") . "\" }"; // note at point on "u"
?>