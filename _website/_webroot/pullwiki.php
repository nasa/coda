<?php
header('Content-Type: application/json');

//echo '<h1>whoami:</h1>';
//$output = shell_exec("whoami");

//echo "<pre>";
//print_r ($output);
//echo "</pre>";

//echo '<h1>wiki json:</h1>';
//$wikijson = exec("/d1/git/bash-api/test.sh");
//$wikijsonobject = json_decode($wikijson);

$action = htmlspecialchars($_GET["action"]);
if ($action == 'getEVAs') {
    $parameters = '"[[~US EVA*]] [[EVA Classification::Scheduled or Historical]] |?EVA title |? Start date |? Start time |sort=Start date |format = json"';
} elseif ($action == 'getCrew') {
    $evaName = htmlspecialchars($_GET["evaName"]);
    $parameters = '"[[Crew involved with subject::+]] [[From page::' . $evaName . ']] |? Has full name |? Has role |? Has EMU Page  |format = json"';
} elseif ($action == 'getEVADetails') {
    $evaName = htmlspecialchars($_GET["evaName"]);
    $parameters = '"[[' . $evaName . ']] |? EVA title |? Start date |? Start time |? Duration |format = json"';
} elseif ($action == 'getEVADetailsByDate') {
    $evaDate = htmlspecialchars($_GET["evaDate"]);
    $parameters = '"[[~US EVA*]] [[Start date::' . $evaDate . ']] [[EVA Classification::Scheduled or Historical]] |? EVA title |? Start date |? Start time |? Duration |format = json"';
} elseif ($action == 'getAsExecuted') {
    $EVNum = htmlspecialchars($_GET["EVNum"]);
    if ($EVNum == '1')
        $actorName = 'Actor2';
    elseif ($EVNum == '2')
        $actorName = 'Actor3';
    $evaName = htmlspecialchars($_GET["evaName"]);
    $parameters = '"[[From page::~' . $evaName . '/*xecuted*]] [[Assigned to::' . $actorName . ']] |mainlabel=-|?Index |?Has text title |?Duration hour |?Duration minute |?Depends on |?Related article |?Color |?Actor |named args=yes |sort=Actor, Index |format = json"';
}

//$parameters = '"[[~US EVA*]] [[EVA Classification::Scheduled or Historical]] |? Start date |limit=10000 |sort=Start date"';
//$parameters = '"[[Crew involved with subject::+]] [[From page::US EVA 55]] |? Has full name |? Has role  "';
//$parameters = '"[[US EVA 55]] [[EVA Classification::Scheduled or Historical]] |? EVA title |? Start date |? Start time |? Duration"';

//echo($parameters);
$command = "./lib/bash-api/test.sh " . $parameters;
//printf($command);

$output = shell_exec($command);

//echo "<pre>";
printf ($output);
//echo "</pre>";
