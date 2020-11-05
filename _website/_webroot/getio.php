<?php

header('Content-Type: application/json');
$IOParam = urldecode($_GET["IOParam"]);

$command = 'curl -H "Origin: https://coda-dev.fit.nasa.gov" "' . $IOParam . '"';
//printf($command);

$output = shell_exec($command);

//echo "<pre>";
printf ($output);