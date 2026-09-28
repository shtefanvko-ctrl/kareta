<?php
declare(strict_types=1);
require __DIR__.'/../api/bootstrap.php';

$root=dirname(__DIR__);
$communityApi=(string)file_get_contents($root.'/js/next/community/community_api.js');
$communityPage=(string)file_get_contents($root.'/js/next/pages/community.js');
$dbApi=(string)file_get_contents($root.'/api/db.php');
$communityPhp=(string)file_get_contents($root.'/api/community_posts.php');
$seed=(string)file_get_contents(__DIR__.'/seed_social_demo_84_127.php');

$fail=[];
$expect=static function(bool $ok,string $message) use (&$fail): void { if(!$ok)$fail[]=$message; };

$expect(!str_contains($communityApi,"function getGroups(){return isProduction()?[]"),'production getGroups returned empty fixture');
$expect(str_contains($communityApi,'communityGroups.list'),'community groups GET client missing');
$expect(str_contains($communityApi,'setGroupMembership'),'group membership client missing');
$expect(str_contains($communityApi,'loadGroupMembers'),'group members client missing');
$expect(str_contains($dbApi,"communityGroups.list"),'communityGroups.list route missing');
$expect(str_contains($dbApi,"communityGroups.members"),'communityGroups.members route missing');
$expect(str_contains($dbApi,"communityGroups.join"),'communityGroups.join route missing');
$expect(str_contains($communityPhp,'CREATE TABLE IF NOT EXISTS community_groups'),'community_groups DB table missing');
$expect(str_contains($communityPhp,'CREATE TABLE IF NOT EXISTS community_group_members'),'community_group_members DB table missing');
$expect(str_contains($communityPhp,'group_id VARCHAR(64)'),'community post group_id missing');
$expect(str_contains($communityPage,'groupWasMissing'),'direct group hydration guard missing');
$expect(str_contains($communityPage,"new HashChangeEvent('hashchange')"),'direct group re-render missing');
$expect(str_contains($communityPage,'paintGroupDiscussions'),'group discussions not DB-backed');
$expect(str_contains($communityPage,'paintGroupMembers'),'group members not DB-backed');
$expect(str_contains($communityPage,'data-community-repair-reply'),'repair question inline replies missing');
$expect(str_contains($seed,'demo84_127_question_'),'question seed missing');
$expect(str_contains($seed,'demo84_127_chat_'),'chat seed missing');

$pdo=kareta_pdo();
if(!$pdo){$fail[]='database unavailable';}
else{
  $scalar=static function(string $sql) use($pdo): int { return (int)$pdo->query($sql)->fetchColumn(); };
  $expect($scalar("SELECT COUNT(*) FROM users WHERE phone BETWEEN '+77007770101' AND '+77007770110'")===10,'expected 10 demo users');
  $expect($scalar("SELECT COUNT(*) FROM community_groups WHERE id LIKE 'demo84_127_group_%' AND active=1")===10,'expected 10 groups');
  $expect($scalar("SELECT COUNT(*) FROM community_posts WHERE id LIKE 'demo84_127_question_%' AND post_type='QUESTION' AND group_id<>''")===10,'expected 10 linked questions');
  $expect($scalar("SELECT COUNT(*) FROM community_posts WHERE id LIKE 'demo84_127_post_%' AND group_id<>''")===10,'expected 10 linked posts');
  $expect($scalar("SELECT COUNT(*) FROM master_wall_comments_social WHERE id LIKE 'demo84_127_comment_%' AND active=1")===30,'expected 30 comments');
  $expect($scalar("SELECT COUNT(*) FROM chats WHERE id LIKE 'demo84_127_chat_%' AND status='active'")===10,'expected 10 chats');
  $expect($scalar("SELECT COUNT(*) FROM messages WHERE id LIKE 'demo84_127_msg_%' AND deleted_at IS NULL")===50,'expected 50 messages');
  $expect($scalar("SELECT COUNT(*) FROM chat_participants WHERE chat_id LIKE 'demo84_127_chat_%' AND left_at IS NULL")===20,'expected exactly 20 active chat participants');
  foreach([[1,'client'],[1,'master'],[3,'client'],[3,'master']] as [$uid,$role]){
    $q=$pdo->prepare("SELECT COUNT(*) FROM chat_participants WHERE chat_id LIKE 'demo84_127_chat_%' AND user_id=? AND role=? AND left_at IS NULL");
    $q->execute([$uid,$role]);
    $expect((int)$q->fetchColumn()===5,"expected user {$uid} to have 5 {$role} chats");
  }
  $expect($scalar("SELECT COUNT(*) FROM community_posts p WHERE p.id LIKE 'demo84_127_question_%' AND (SELECT COUNT(*) FROM master_wall_comments_social c WHERE c.entity_key=CONCAT('community:',p.id) AND c.active=1)>=3")===10,'every seeded question must have at least 3 comments');
}

if($fail){
  fwrite(STDERR,"R188.5.5.6.84.127 FAIL\n- ".implode("\n- ",$fail)."\n");
  exit(1);
}
echo "R188.5.5.6.84.127 OK — DB communities + social seed + current-user chats\n";
