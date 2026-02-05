(module
 (type $0 (func (param i32)))
 (type $1 (func))
 (type $2 (func (param i32 i32)))
 (type $3 (func (param i32) (result i32)))
 (type $4 (func (param i32 i32 i32 i32)))
 (type $5 (func (param i32 i32 i64)))
 (type $6 (func (result i32)))
 (type $7 (func (param i32 i32) (result i32)))
 (type $8 (func (param i32 i32 i32 i32 i32) (result i32)))
 (type $9 (func (param i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $assembly/index/FLUSH_TABLE (mut i32) (i32.const 0))
 (global $assembly/index/UNIQUE5_TABLE (mut i32) (i32.const 0))
 (global $assembly/index/PAIRS_TABLE (mut i32) (i32.const 0))
 (global $assembly/index/initialized (mut i32) (i32.const 0))
 (global $assembly/index/playerHands (mut i32) (i32.const 0))
 (global $assembly/index/playerLens (mut i32) (i32.const 0))
 (global $assembly/index/board (mut i32) (i32.const 0))
 (global $assembly/index/deck (mut i32) (i32.const 0))
 (global $assembly/index/wins (mut i32) (i32.const 0))
 (global $assembly/index/ties (mut i32) (i32.const 0))
 (global $assembly/index/scores (mut i32) (i32.const 0))
 (global $assembly/index/numPlayers (mut i32) (i32.const 0))
 (global $assembly/index/boardLen (mut i32) (i32.const 0))
 (global $assembly/index/deckLen (mut i32) (i32.const 0))
 (global $assembly/index/seed (mut i32) (i32.const 12345))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 34728))
 (memory $0 1)
 (data $0 (i32.const 1036) ",")
 (data $0.1 (i32.const 1048) "\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h")
 (data $1 (i32.const 1084) "<")
 (data $1.1 (i32.const 1096) "\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00s\00t\00a\00t\00i\00c\00a\00r\00r\00a\00y\00.\00t\00s")
 (data $2 (i32.const 1148) "<")
 (data $2.1 (i32.const 1160) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $3 (i32.const 1212) "<")
 (data $3.1 (i32.const 1224) "\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s")
 (data $6 (i32.const 1340) "<")
 (data $6.1 (i32.const 1352) "\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e")
 (data $7 (i32.const 1404) ",")
 (data $7.1 (i32.const 1416) "\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s")
 (data $9 (i32.const 1484) "<")
 (data $9.1 (i32.const 1496) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $10 (i32.const 1548) "<")
 (data $10.1 (i32.const 1560) "\04\00\00\00(\00\00\00\0f\10\00\00\1f\00\00\00>\00\00\00|\00\00\00\f8\00\00\00\f0\01\00\00\e0\03\00\00\c0\07\00\00\80\0f\00\00\00\1f")
 (data $11 (i32.const 1612) "<")
 (data $11.1 (i32.const 1624) "\04\00\00\00(")
 (data $11.2 (i32.const 1648) "\01\00\00\00\01\00\00\00\01\00\00\00\02\00\00\00\02\00\00\00\03")
 (data $12 (i32.const 1676) "<")
 (data $12.1 (i32.const 1688) "\04\00\00\00(\00\00\00\01\00\00\00\02\00\00\00\03\00\00\00\04\00\00\00\02\00\00\00\03\00\00\00\04\00\00\00\03\00\00\00\04\00\00\00\04")
 (data $13 (i32.const 1740) "<")
 (data $13.1 (i32.const 1752) "\04\00\00\00(")
 (data $13.2 (i32.const 1784) "\01\00\00\00\01\00\00\00\01\00\00\00\02")
 (data $14 (i32.const 1804) "<")
 (data $14.1 (i32.const 1816) "\04\00\00\00(\00\00\00\01\00\00\00\01\00\00\00\01\00\00\00\02\00\00\00\02\00\00\00\03\00\00\00\02\00\00\00\02\00\00\00\03\00\00\00\03")
 (data $15 (i32.const 1868) "<")
 (data $15.1 (i32.const 1880) "\04\00\00\00(\00\00\00\02\00\00\00\03\00\00\00\04\00\00\00\03\00\00\00\04\00\00\00\04\00\00\00\03\00\00\00\04\00\00\00\04\00\00\00\04")
 (data $16 (i32.const 1936) "\05\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00$\t")
 (export "eval5" (func $assembly/index/eval5))
 (export "init" (func $assembly/index/init))
 (export "setPlayerHand" (func $assembly/index/setPlayerHand))
 (export "setPlayerLen" (func $assembly/index/setPlayerLen))
 (export "setNumPlayers" (func $assembly/index/setNumPlayers))
 (export "setBoardCard" (func $assembly/index/setBoardCard))
 (export "setBoardLen" (func $assembly/index/setBoardLen))
 (export "buildDeck" (func $assembly/index/buildDeck))
 (export "setSeed" (func $assembly/index/setSeed))
 (export "calculate" (func $assembly/index/calculate))
 (export "getWins" (func $assembly/index/getWins))
 (export "getTies" (func $assembly/index/getTies))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/rt/itcms/visitRoots
  (local $0 i32)
  (local $1 i32)
  global.get $assembly/index/FLUSH_TABLE
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/UNIQUE5_TABLE
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/PAIRS_TABLE
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  i32.const 1568
  call $~lib/rt/itcms/__visit
  i32.const 1632
  call $~lib/rt/itcms/__visit
  i32.const 1696
  call $~lib/rt/itcms/__visit
  i32.const 1760
  call $~lib/rt/itcms/__visit
  i32.const 1824
  call $~lib/rt/itcms/__visit
  i32.const 1888
  call $~lib/rt/itcms/__visit
  global.get $assembly/index/playerHands
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/playerLens
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/board
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/deck
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/wins
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/ties
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/index/scores
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  i32.const 1360
  call $~lib/rt/itcms/__visit
  i32.const 1056
  call $~lib/rt/itcms/__visit
  i32.const 1168
  call $~lib/rt/itcms/__visit
  global.get $~lib/rt/itcms/pinSpace
  local.tee $1
  i32.load offset=4
  i32.const -4
  i32.and
  local.set $0
  loop $while-continue|0
   local.get $0
   local.get $1
   i32.ne
   if
    local.get $0
    i32.load offset=4
    drop
    local.get $0
    i32.const 20
    i32.add
    call $~lib/rt/__visit_members
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/itcms/__visit (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  i32.eqz
  if
   return
  end
  global.get $~lib/rt/itcms/white
  local.get $0
  i32.const 20
  i32.sub
  local.tee $0
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $0
   global.get $~lib/rt/itcms/iter
   i32.eq
   if
    local.get $0
    i32.load offset=8
    global.set $~lib/rt/itcms/iter
   end
   block $__inlined_func$~lib/rt/itcms/Object#unlink$169
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    local.tee $1
    i32.eqz
    if
     local.get $0
     i32.load offset=8
     drop
     br $__inlined_func$~lib/rt/itcms/Object#unlink$169
    end
    local.get $1
    local.get $0
    i32.load offset=8
    local.tee $2
    i32.store offset=8
    local.get $2
    local.get $1
    local.get $2
    i32.load offset=4
    i32.const 3
    i32.and
    i32.or
    i32.store offset=4
   end
   global.get $~lib/rt/itcms/toSpace
   local.set $2
   local.get $0
   i32.load offset=12
   local.tee $1
   i32.const 2
   i32.le_u
   if (result i32)
    i32.const 1
   else
    local.get $1
    i32.const 1936
    i32.load
    i32.gt_u
    if
     i32.const 1360
     i32.const 1424
     i32.const 21
     i32.const 28
     call $~lib/builtins/abort
     unreachable
    end
    local.get $1
    i32.const 2
    i32.shl
    i32.const 1940
    i32.add
    i32.load
    i32.const 32
    i32.and
   end
   local.set $3
   local.get $2
   i32.load offset=8
   local.set $1
   local.get $0
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.const 2
   local.get $3
   select
   local.get $2
   i32.or
   i32.store offset=4
   local.get $0
   local.get $1
   i32.store offset=8
   local.get $1
   local.get $0
   local.get $1
   i32.load offset=4
   i32.const 3
   i32.and
   i32.or
   i32.store offset=4
   local.get $2
   local.get $0
   i32.store offset=8
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/tlsf/removeBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  i32.const -4
  i32.and
  local.tee $3
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $3
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $3
   local.get $3
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $3
   i32.clz
   i32.sub
   local.tee $4
   i32.const 7
   i32.sub
   local.set $2
   local.get $3
   local.get $4
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.set $4
  local.get $1
  i32.load offset=8
  local.set $5
  local.get $1
  i32.load offset=4
  local.tee $3
  if
   local.get $3
   local.get $5
   i32.store offset=8
  end
  local.get $5
  if
   local.get $5
   local.get $3
   i32.store offset=4
  end
  local.get $1
  local.get $0
  local.get $2
  i32.const 4
  i32.shl
  local.get $4
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.tee $1
  i32.load offset=96
  i32.eq
  if
   local.get $1
   local.get $5
   i32.store offset=96
   local.get $5
   i32.eqz
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $1
    i32.load offset=4
    i32.const -2
    local.get $4
    i32.rotl
    i32.and
    local.set $3
    local.get $1
    local.get $3
    i32.store offset=4
    local.get $3
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const -2
     local.get $2
     i32.rotl
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $1
  i32.const 4
  i32.add
  local.tee $6
  local.get $1
  i32.load
  local.tee $3
  i32.const -4
  i32.and
  i32.add
  local.tee $4
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   local.get $0
   local.get $4
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $3
   i32.const 4
   i32.add
   local.get $2
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
   local.get $6
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $4
   i32.load
   local.set $2
  end
  local.get $3
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $1
   i32.load
   local.set $6
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $6
   i32.const 4
   i32.add
   local.get $3
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
  end
  local.get $4
  local.get $2
  i32.const 2
  i32.or
  i32.store
  local.get $4
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $0
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $2
   local.get $2
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $2
   i32.clz
   i32.sub
   local.tee $3
   i32.const 7
   i32.sub
   local.set $5
   local.get $2
   local.get $3
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $2
  local.get $5
  i32.const 4
  i32.shl
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  local.set $3
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  local.get $3
  i32.store offset=8
  local.get $3
  if
   local.get $3
   local.get $1
   i32.store offset=4
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $5
  i32.shl
  i32.or
  i32.store
  local.get $0
  local.get $5
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load offset=4
  i32.const 1
  local.get $2
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $0 i32) (param $1 i32) (param $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.set $1
  local.get $0
  i32.load offset=1568
  local.tee $3
  if
   local.get $1
   i32.const 16
   i32.sub
   local.tee $5
   local.get $3
   i32.eq
   if
    local.get $3
    i32.load
    local.set $4
    local.get $5
    local.set $1
   end
  end
  local.get $2
  i32.wrap_i64
  i32.const -16
  i32.and
  local.get $1
  i32.sub
  local.tee $3
  i32.const 20
  i32.lt_u
  if
   return
  end
  local.get $1
  local.get $4
  i32.const 2
  i32.and
  local.get $3
  i32.const 8
  i32.sub
  local.tee $3
  i32.const 1
  i32.or
  i32.or
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.store offset=8
  local.get $1
  i32.const 4
  i32.add
  local.get $3
  i32.add
  local.tee $3
  i32.const 2
  i32.store
  local.get $0
  local.get $3
  i32.store offset=1568
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/initialize
  (local $0 i32)
  (local $1 i32)
  memory.size
  local.tee $0
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
   local.get $0
   i32.sub
   memory.grow
   i32.const 0
   i32.lt_s
  else
   i32.const 0
  end
  if
   unreachable
  end
  i32.const 34736
  i32.const 0
  i32.store
  i32.const 36304
  i32.const 0
  i32.store
  loop $for-loop|0
   local.get $1
   i32.const 23
   i32.lt_u
   if
    local.get $1
    i32.const 2
    i32.shl
    i32.const 34736
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $0
    loop $for-loop|1
     local.get $0
     i32.const 16
     i32.lt_u
     if
      local.get $1
      i32.const 4
      i32.shl
      local.get $0
      i32.add
      i32.const 2
      i32.shl
      i32.const 34736
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $0
      i32.const 1
      i32.add
      local.set $0
      br $for-loop|1
     end
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  i32.const 34736
  i32.const 36308
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  i32.const 34736
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/itcms/step (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  block $break|0
   block $case2|0
    block $case1|0
     block $case0|0
      global.get $~lib/rt/itcms/state
      br_table $case0|0 $case1|0 $case2|0 $break|0
     end
     i32.const 1
     global.set $~lib/rt/itcms/state
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/visitCount
     return
    end
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.set $1
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    loop $while-continue|1
     local.get $0
     global.get $~lib/rt/itcms/toSpace
     i32.ne
     if
      local.get $0
      global.set $~lib/rt/itcms/iter
      local.get $1
      local.get $0
      i32.load offset=4
      local.tee $2
      i32.const 3
      i32.and
      i32.ne
      if
       local.get $0
       local.get $2
       i32.const -4
       i32.and
       local.get $1
       i32.or
       i32.store offset=4
       i32.const 0
       global.set $~lib/rt/itcms/visitCount
       local.get $0
       i32.const 20
       i32.add
       call $~lib/rt/__visit_members
       global.get $~lib/rt/itcms/visitCount
       return
      end
      local.get $0
      i32.load offset=4
      i32.const -4
      i32.and
      local.set $0
      br $while-continue|1
     end
    end
    i32.const 0
    global.set $~lib/rt/itcms/visitCount
    call $~lib/rt/itcms/visitRoots
    global.get $~lib/rt/itcms/toSpace
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    i32.eq
    if
     global.get $~lib/memory/__stack_pointer
     local.set $0
     loop $while-continue|0
      local.get $0
      i32.const 34728
      i32.lt_u
      if
       local.get $0
       i32.load
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.const 4
       i32.add
       local.set $0
       br $while-continue|0
      end
     end
     global.get $~lib/rt/itcms/iter
     i32.load offset=4
     i32.const -4
     i32.and
     local.set $0
     loop $while-continue|2
      local.get $0
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $1
       local.get $0
       i32.load offset=4
       local.tee $2
       i32.const 3
       i32.and
       i32.ne
       if
        local.get $0
        local.get $2
        i32.const -4
        i32.and
        local.get $1
        i32.or
        i32.store offset=4
        local.get $0
        i32.const 20
        i32.add
        call $~lib/rt/__visit_members
       end
       local.get $0
       i32.load offset=4
       i32.const -4
       i32.and
       local.set $0
       br $while-continue|2
      end
     end
     global.get $~lib/rt/itcms/fromSpace
     local.set $0
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/fromSpace
     local.get $0
     global.set $~lib/rt/itcms/toSpace
     local.get $1
     global.set $~lib/rt/itcms/white
     local.get $0
     i32.load offset=4
     i32.const -4
     i32.and
     global.set $~lib/rt/itcms/iter
     i32.const 2
     global.set $~lib/rt/itcms/state
    end
    global.get $~lib/rt/itcms/visitCount
    return
   end
   global.get $~lib/rt/itcms/iter
   local.tee $0
   global.get $~lib/rt/itcms/toSpace
   i32.ne
   if
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    global.set $~lib/rt/itcms/iter
    local.get $0
    i32.const 34728
    i32.lt_u
    if
     local.get $0
     i32.const 0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=8
    else
     global.get $~lib/rt/itcms/total
     local.get $0
     i32.load
     i32.const -4
     i32.and
     i32.const 4
     i32.add
     i32.sub
     global.set $~lib/rt/itcms/total
     local.get $0
     i32.const 4
     i32.add
     local.tee $0
     i32.const 34728
     i32.ge_u
     if
      global.get $~lib/rt/tlsf/ROOT
      i32.eqz
      if
       call $~lib/rt/tlsf/initialize
      end
      local.get $0
      i32.const 4
      i32.sub
      local.set $1
      local.get $0
      i32.const 15
      i32.and
      i32.const 1
      local.get $0
      select
      if (result i32)
       i32.const 1
      else
       local.get $1
       i32.load
       i32.const 1
       i32.and
      end
      drop
      local.get $1
      local.get $1
      i32.load
      i32.const 1
      i32.or
      i32.store
      global.get $~lib/rt/tlsf/ROOT
      local.get $1
      call $~lib/rt/tlsf/insertBlock
     end
    end
    i32.const 10
    return
   end
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=4
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=8
   i32.const 0
   global.set $~lib/rt/itcms/state
  end
  i32.const 0
 )
 (func $~lib/rt/tlsf/searchBlock (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
  else
   local.get $1
   i32.const 536870910
   i32.lt_u
   if
    local.get $1
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    i32.add
    i32.const 1
    i32.sub
    local.set $1
   end
   local.get $1
   i32.const 31
   local.get $1
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $1
   local.get $2
   i32.const 7
   i32.sub
   local.set $2
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $0
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
  else
   local.get $0
   i32.load
   i32.const -1
   local.get $2
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.tee $1
   if (result i32)
    local.get $0
    local.get $0
    local.get $1
    i32.ctz
    local.tee $0
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=4
    i32.ctz
    local.get $0
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/itcms/__new (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $0
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 1168
   i32.const 1232
   i32.const 261
   i32.const 31
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   block $__inlined_func$~lib/rt/itcms/interrupt$69
    i32.const 2048
    local.set $1
    loop $do-loop|0
     local.get $1
     call $~lib/rt/itcms/step
     i32.sub
     local.set $1
     global.get $~lib/rt/itcms/state
     i32.eqz
     if
      global.get $~lib/rt/itcms/total
      i64.extend_i32_u
      i64.const 200
      i64.mul
      i64.const 100
      i64.div_u
      i32.wrap_i64
      i32.const 1024
      i32.add
      global.set $~lib/rt/itcms/threshold
      br $__inlined_func$~lib/rt/itcms/interrupt$69
     end
     local.get $1
     i32.const 0
     i32.gt_s
     br_if $do-loop|0
    end
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/threshold
    i32.sub
    i32.const 1024
    i32.lt_u
    i32.const 10
    i32.shl
    i32.add
    global.set $~lib/rt/itcms/threshold
   end
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.set $3
  local.get $0
  i32.const 16
  i32.add
  local.tee $1
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 1168
   i32.const 1504
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  local.get $1
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $1
   i32.const 19
   i32.add
   i32.const -16
   i32.and
   i32.const 4
   i32.sub
  end
  local.tee $4
  call $~lib/rt/tlsf/searchBlock
  local.tee $1
  i32.eqz
  if
   memory.size
   local.tee $1
   local.get $4
   i32.const 256
   i32.ge_u
   if (result i32)
    local.get $4
    i32.const 536870910
    i32.lt_u
    if (result i32)
     local.get $4
     i32.const 1
     i32.const 27
     local.get $4
     i32.clz
     i32.sub
     i32.shl
     i32.add
     i32.const 1
     i32.sub
    else
     local.get $4
    end
   else
    local.get $4
   end
   i32.const 4
   local.get $3
   i32.load offset=1568
   local.get $1
   i32.const 16
   i32.shl
   i32.const 4
   i32.sub
   i32.ne
   i32.shl
   i32.add
   i32.const 65535
   i32.add
   i32.const -65536
   i32.and
   i32.const 16
   i32.shr_u
   local.tee $2
   local.get $1
   local.get $2
   i32.gt_s
   select
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $2
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
   local.get $3
   local.get $1
   i32.const 16
   i32.shl
   memory.size
   i64.extend_i32_s
   i64.const 16
   i64.shl
   call $~lib/rt/tlsf/addMemory
   local.get $3
   local.get $4
   call $~lib/rt/tlsf/searchBlock
   local.set $1
  end
  local.get $1
  i32.load
  drop
  local.get $3
  local.get $1
  call $~lib/rt/tlsf/removeBlock
  local.get $1
  i32.load
  local.tee $2
  i32.const -4
  i32.and
  local.get $4
  i32.sub
  local.tee $5
  i32.const 16
  i32.ge_u
  if
   local.get $1
   local.get $4
   local.get $2
   i32.const 2
   i32.and
   i32.or
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $4
   i32.add
   local.tee $2
   local.get $5
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   i32.store
   local.get $3
   local.get $2
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $1
   local.get $2
   i32.const -2
   i32.and
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $2
   local.get $2
   i32.load
   i32.const -3
   i32.and
   i32.store
  end
  local.get $1
  i32.const 4
  i32.store offset=12
  local.get $1
  local.get $0
  i32.store offset=16
  global.get $~lib/rt/itcms/fromSpace
  local.tee $2
  i32.load offset=8
  local.set $3
  local.get $1
  local.get $2
  global.get $~lib/rt/itcms/white
  i32.or
  i32.store offset=4
  local.get $1
  local.get $3
  i32.store offset=8
  local.get $3
  local.get $1
  local.get $3
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $2
  local.get $1
  i32.store offset=8
  global.get $~lib/rt/itcms/total
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.const 4
  i32.add
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $1
  i32.const 20
  i32.add
  local.tee $1
  i32.const 0
  local.get $0
  memory.fill
  local.get $1
 )
 (func $assembly/index/init
  call $assembly/index/initTables
 )
 (func $assembly/index/setNumPlayers (param $0 i32)
  local.get $0
  global.set $assembly/index/numPlayers
 )
 (func $assembly/index/setBoardLen (param $0 i32)
  local.get $0
  global.set $assembly/index/boardLen
 )
 (func $assembly/index/setSeed (param $0 i32)
  local.get $0
  global.set $assembly/index/seed
 )
 (func $~lib/rt/__visit_members (param $0 i32)
  block $invalid
   block $~lib/staticarray/StaticArray<i32>
    block $~lib/arraybuffer/ArrayBufferView
     block $~lib/string/String
      block $~lib/arraybuffer/ArrayBuffer
       block $~lib/object/Object
        local.get $0
        i32.const 8
        i32.sub
        i32.load
        br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $~lib/staticarray/StaticArray<i32> $invalid
       end
       return
      end
      return
     end
     return
    end
    local.get $0
    i32.load
    call $~lib/rt/itcms/__visit
    return
   end
   return
  end
  unreachable
 )
 (func $~start
  memory.size
  i32.const 16
  i32.shl
  i32.const 34728
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  i32.const 1284
  i32.const 1280
  i32.store
  i32.const 1288
  i32.const 1280
  i32.store
  i32.const 1280
  global.set $~lib/rt/itcms/pinSpace
  i32.const 1316
  i32.const 1312
  i32.store
  i32.const 1320
  i32.const 1312
  i32.store
  i32.const 1312
  global.set $~lib/rt/itcms/toSpace
  i32.const 1460
  i32.const 1456
  i32.store
  i32.const 1464
  i32.const 1456
  i32.store
  i32.const 1456
  global.set $~lib/rt/itcms/fromSpace
  i32.const 8192
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/FLUSH_TABLE
  i32.const 8192
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/UNIQUE5_TABLE
  i32.const 6561
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/PAIRS_TABLE
  i32.const 35
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/playerHands
  i32.const 7
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/playerLens
  i32.const 5
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/board
  i32.const 52
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/deck
  i32.const 7
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/wins
  i32.const 7
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/ties
  i32.const 7
  call $~lib/staticarray/StaticArray<i32>#constructor
  global.set $assembly/index/scores
 )
 (func $assembly/index/eval5 (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (result i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $1
  i32.const 3
  i32.and
  local.tee $5
  local.get $2
  i32.const 3
  i32.and
  local.tee $6
  i32.eq
  local.get $5
  local.get $0
  i32.const 3
  i32.and
  i32.eq
  i32.and
  local.get $3
  i32.const 3
  i32.and
  local.tee $5
  local.get $6
  i32.eq
  i32.and
  local.get $4
  i32.const 3
  i32.and
  local.get $5
  i32.eq
  i32.and
  local.set $5
  block $folding-inner0
   i32.const 1
   local.get $0
   i32.const 2
   i32.shr_s
   local.tee $0
   i32.shl
   i32.const 1
   local.get $1
   i32.const 2
   i32.shr_s
   local.tee $1
   i32.shl
   i32.or
   i32.const 1
   local.get $2
   i32.const 2
   i32.shr_s
   local.tee $2
   i32.shl
   i32.or
   i32.const 1
   local.get $3
   i32.const 2
   i32.shr_s
   local.tee $3
   i32.shl
   i32.or
   i32.const 1
   local.get $4
   i32.const 2
   i32.shr_s
   local.tee $6
   i32.shl
   i32.or
   local.tee $4
   local.get $4
   i32.const 1
   i32.shr_s
   i32.const 1431655765
   i32.and
   i32.sub
   local.tee $7
   i32.const 858993459
   i32.and
   local.get $7
   i32.const 2
   i32.shr_s
   i32.const 858993459
   i32.and
   i32.add
   local.tee $7
   i32.const 4
   i32.shr_u
   local.get $7
   i32.add
   i32.const 252645135
   i32.and
   local.tee $7
   i32.const 8
   i32.shr_u
   local.get $7
   i32.add
   local.tee $7
   i32.const 16
   i32.shr_s
   local.get $7
   i32.add
   i32.const 63
   i32.and
   i32.const 5
   i32.eq
   if
    local.get $5
    if
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/FLUSH_TABLE
     local.tee $0
     i32.store
     br $folding-inner0
    end
    global.get $~lib/memory/__stack_pointer
    global.get $assembly/index/UNIQUE5_TABLE
    local.tee $0
    i32.store
    br $folding-inner0
   end
   i32.const 0
   local.set $4
   local.get $0
   if
    local.get $0
    i32.const 1
    i32.eq
    if
     i32.const 1
     local.set $8
    else
     local.get $0
     i32.const 2
     i32.eq
     if
      i32.const 1
      local.set $19
     else
      local.get $0
      i32.const 3
      i32.eq
      if
       i32.const 1
       local.set $4
      else
       local.get $0
       i32.const 4
       i32.eq
       if
        i32.const 1
        local.set $9
       else
        local.get $0
        i32.const 5
        i32.eq
        if
         i32.const 1
         local.set $10
        else
         local.get $0
         i32.const 6
         i32.eq
         if
          i32.const 1
          local.set $11
         else
          local.get $0
          i32.const 7
          i32.eq
          if
           i32.const 1
           local.set $12
          else
           local.get $0
           i32.const 8
           i32.eq
           if
            i32.const 1
            local.set $13
           else
            local.get $0
            i32.const 9
            i32.eq
            if
             i32.const 1
             local.set $14
            else
             local.get $0
             i32.const 10
             i32.eq
             if
              i32.const 1
              local.set $15
             else
              local.get $0
              i32.const 11
              i32.eq
              if
               i32.const 1
               local.set $16
              else
               i32.const 1
               local.set $17
              end
             end
            end
           end
          end
         end
        end
       end
      end
     end
    end
   else
    i32.const 1
    local.set $18
   end
   local.get $1
   if
    local.get $1
    i32.const 1
    i32.eq
    if
     local.get $8
     i32.const 1
     i32.add
     local.set $8
    else
     local.get $1
     i32.const 2
     i32.eq
     if
      local.get $19
      i32.const 1
      i32.add
      local.set $19
     else
      local.get $1
      i32.const 3
      i32.eq
      if
       local.get $4
       i32.const 1
       i32.add
       local.set $4
      else
       local.get $1
       i32.const 4
       i32.eq
       if
        local.get $9
        i32.const 1
        i32.add
        local.set $9
       else
        local.get $1
        i32.const 5
        i32.eq
        if
         local.get $10
         i32.const 1
         i32.add
         local.set $10
        else
         local.get $1
         i32.const 6
         i32.eq
         if
          local.get $11
          i32.const 1
          i32.add
          local.set $11
         else
          local.get $1
          i32.const 7
          i32.eq
          if
           local.get $12
           i32.const 1
           i32.add
           local.set $12
          else
           local.get $1
           i32.const 8
           i32.eq
           if
            local.get $13
            i32.const 1
            i32.add
            local.set $13
           else
            local.get $1
            i32.const 9
            i32.eq
            if
             local.get $14
             i32.const 1
             i32.add
             local.set $14
            else
             local.get $1
             i32.const 10
             i32.eq
             if
              local.get $15
              i32.const 1
              i32.add
              local.set $15
             else
              local.get $1
              i32.const 11
              i32.eq
              if
               local.get $16
               i32.const 1
               i32.add
               local.set $16
              else
               local.get $17
               i32.const 1
               i32.add
               local.set $17
              end
             end
            end
           end
          end
         end
        end
       end
      end
     end
    end
   else
    local.get $18
    i32.const 1
    i32.add
    local.set $18
   end
   local.get $2
   if
    local.get $2
    i32.const 1
    i32.eq
    if
     local.get $8
     i32.const 1
     i32.add
     local.set $8
    else
     local.get $2
     i32.const 2
     i32.eq
     if
      local.get $19
      i32.const 1
      i32.add
      local.set $19
     else
      local.get $2
      i32.const 3
      i32.eq
      if
       local.get $4
       i32.const 1
       i32.add
       local.set $4
      else
       local.get $2
       i32.const 4
       i32.eq
       if
        local.get $9
        i32.const 1
        i32.add
        local.set $9
       else
        local.get $2
        i32.const 5
        i32.eq
        if
         local.get $10
         i32.const 1
         i32.add
         local.set $10
        else
         local.get $2
         i32.const 6
         i32.eq
         if
          local.get $11
          i32.const 1
          i32.add
          local.set $11
         else
          local.get $2
          i32.const 7
          i32.eq
          if
           local.get $12
           i32.const 1
           i32.add
           local.set $12
          else
           local.get $2
           i32.const 8
           i32.eq
           if
            local.get $13
            i32.const 1
            i32.add
            local.set $13
           else
            local.get $2
            i32.const 9
            i32.eq
            if
             local.get $14
             i32.const 1
             i32.add
             local.set $14
            else
             local.get $2
             i32.const 10
             i32.eq
             if
              local.get $15
              i32.const 1
              i32.add
              local.set $15
             else
              local.get $2
              i32.const 11
              i32.eq
              if
               local.get $16
               i32.const 1
               i32.add
               local.set $16
              else
               local.get $17
               i32.const 1
               i32.add
               local.set $17
              end
             end
            end
           end
          end
         end
        end
       end
      end
     end
    end
   else
    local.get $18
    i32.const 1
    i32.add
    local.set $18
   end
   local.get $3
   if
    local.get $3
    i32.const 1
    i32.eq
    if
     local.get $8
     i32.const 1
     i32.add
     local.set $8
    else
     local.get $3
     i32.const 2
     i32.eq
     if
      local.get $4
      i32.const 1
      i32.add
      local.set $4
     else
      local.get $3
      i32.const 3
      i32.eq
      if
       local.get $4
       i32.const 1
       i32.add
       local.set $4
      else
       local.get $3
       i32.const 4
       i32.eq
       if
        local.get $9
        i32.const 1
        i32.add
        local.set $9
       else
        local.get $3
        i32.const 5
        i32.eq
        if
         local.get $10
         i32.const 1
         i32.add
         local.set $10
        else
         local.get $3
         i32.const 6
         i32.eq
         if
          local.get $11
          i32.const 1
          i32.add
          local.set $11
         else
          local.get $3
          i32.const 7
          i32.eq
          if
           local.get $12
           i32.const 1
           i32.add
           local.set $12
          else
           local.get $3
           i32.const 8
           i32.eq
           if
            local.get $13
            i32.const 1
            i32.add
            local.set $13
           else
            local.get $3
            i32.const 9
            i32.eq
            if
             local.get $14
             i32.const 1
             i32.add
             local.set $14
            else
             local.get $3
             i32.const 10
             i32.eq
             if
              local.get $15
              i32.const 1
              i32.add
              local.set $15
             else
              local.get $3
              i32.const 11
              i32.eq
              if
               local.get $16
               i32.const 1
               i32.add
               local.set $16
              else
               local.get $17
               i32.const 1
               i32.add
               local.set $17
              end
             end
            end
           end
          end
         end
        end
       end
      end
     end
    end
   else
    local.get $18
    i32.const 1
    i32.add
    local.set $18
   end
   local.get $6
   if
    local.get $6
    i32.const 1
    i32.eq
    if
     local.get $8
     i32.const 1
     i32.add
     local.set $8
    else
     local.get $6
     i32.const 2
     i32.eq
     if
      local.get $19
      i32.const 1
      i32.add
      local.set $19
     else
      local.get $6
      i32.const 3
      i32.eq
      if
       local.get $4
       i32.const 1
       i32.add
       local.set $4
      else
       local.get $6
       i32.const 4
       i32.eq
       if
        local.get $9
        i32.const 1
        i32.add
        local.set $9
       else
        local.get $6
        i32.const 5
        i32.eq
        if
         local.get $10
         i32.const 1
         i32.add
         local.set $10
        else
         local.get $6
         i32.const 6
         i32.eq
         if
          local.get $11
          i32.const 1
          i32.add
          local.set $11
         else
          local.get $6
          i32.const 7
          i32.eq
          if
           local.get $12
           i32.const 1
           i32.add
           local.set $12
          else
           local.get $6
           i32.const 8
           i32.eq
           if
            local.get $13
            i32.const 1
            i32.add
            local.set $13
           else
            local.get $6
            i32.const 9
            i32.eq
            if
             local.get $14
             i32.const 1
             i32.add
             local.set $14
            else
             local.get $6
             i32.const 10
             i32.eq
             if
              local.get $15
              i32.const 1
              i32.add
              local.set $15
             else
              local.get $6
              i32.const 11
              i32.eq
              if
               local.get $16
               i32.const 1
               i32.add
               local.set $16
              else
               local.get $17
               i32.const 1
               i32.add
               local.set $17
              end
             end
            end
           end
          end
         end
        end
       end
      end
     end
    end
   else
    local.get $18
    i32.const 1
    i32.add
    local.set $18
   end
   i32.const -1
   local.set $5
   i32.const -1
   local.set $3
   i32.const -1
   local.set $0
   i32.const -1
   local.set $6
   i32.const -1
   local.set $1
   i32.const -1
   local.set $2
   i32.const -1
   local.set $7
   local.get $17
   i32.const 4
   i32.eq
   if
    i32.const 12
    local.set $5
   else
    local.get $17
    i32.const 3
    i32.eq
    if
     i32.const 12
     local.set $3
    else
     local.get $17
     i32.const 2
     i32.eq
     if
      i32.const 12
      local.set $0
     else
      i32.const 12
      i32.const -1
      local.get $17
      i32.const 1
      i32.eq
      select
      local.set $1
     end
    end
   end
   local.get $16
   i32.const 4
   i32.eq
   if
    i32.const 11
    local.set $5
   else
    local.get $16
    i32.const 3
    i32.eq
    if
     i32.const 11
     local.set $3
    else
     local.get $16
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 11
       local.set $0
      else
       i32.const 11
       local.set $6
      end
     else
      local.get $16
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 11
        local.set $1
       else
        i32.const 11
        local.set $2
       end
      end
     end
    end
   end
   local.get $15
   i32.const 4
   i32.eq
   if
    i32.const 10
    local.set $5
   else
    local.get $15
    i32.const 3
    i32.eq
    if
     i32.const 10
     local.set $3
    else
     local.get $15
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 10
       local.set $0
      else
       i32.const 10
       local.set $6
      end
     else
      local.get $15
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 10
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 10
         local.set $2
        else
         i32.const 10
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $14
   i32.const 4
   i32.eq
   if
    i32.const 9
    local.set $5
   else
    local.get $14
    i32.const 3
    i32.eq
    if
     i32.const 9
     local.set $3
    else
     local.get $14
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 9
       local.set $0
      else
       i32.const 9
       local.set $6
      end
     else
      local.get $14
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 9
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 9
         local.set $2
        else
         i32.const 9
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $13
   i32.const 4
   i32.eq
   if
    i32.const 8
    local.set $5
   else
    local.get $13
    i32.const 3
    i32.eq
    if
     i32.const 8
     local.set $3
    else
     local.get $13
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 8
       local.set $0
      else
       i32.const 8
       local.set $6
      end
     else
      local.get $13
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 8
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 8
         local.set $2
        else
         i32.const 8
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $12
   i32.const 4
   i32.eq
   if
    i32.const 7
    local.set $5
   else
    local.get $12
    i32.const 3
    i32.eq
    if
     i32.const 7
     local.set $3
    else
     local.get $12
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 7
       local.set $0
      else
       i32.const 7
       local.set $6
      end
     else
      local.get $12
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 7
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 7
         local.set $2
        else
         i32.const 7
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $11
   i32.const 4
   i32.eq
   if
    i32.const 6
    local.set $5
   else
    local.get $11
    i32.const 3
    i32.eq
    if
     i32.const 6
     local.set $3
    else
     local.get $11
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 6
       local.set $0
      else
       i32.const 6
       local.set $6
      end
     else
      local.get $11
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 6
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 6
         local.set $2
        else
         i32.const 6
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $10
   i32.const 4
   i32.eq
   if
    i32.const 5
    local.set $5
   else
    local.get $10
    i32.const 3
    i32.eq
    if
     i32.const 5
     local.set $3
    else
     local.get $10
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 5
       local.set $0
      else
       i32.const 5
       local.set $6
      end
     else
      local.get $10
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 5
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 5
         local.set $2
        else
         i32.const 5
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $9
   i32.const 4
   i32.eq
   if
    i32.const 4
    local.set $5
   else
    local.get $9
    i32.const 3
    i32.eq
    if
     i32.const 4
     local.set $3
    else
     local.get $9
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 4
       local.set $0
      else
       i32.const 4
       local.set $6
      end
     else
      local.get $9
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 4
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 4
         local.set $2
        else
         i32.const 4
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $4
   i32.const 4
   i32.eq
   if
    i32.const 3
    local.set $5
   else
    local.get $4
    i32.const 3
    i32.eq
    if
     i32.const 3
     local.set $3
    else
     local.get $4
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 3
       local.set $0
      else
       i32.const 3
       local.set $6
      end
     else
      local.get $4
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 3
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 3
         local.set $2
        else
         i32.const 3
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $19
   i32.const 4
   i32.eq
   if
    i32.const 2
    local.set $5
   else
    local.get $19
    i32.const 3
    i32.eq
    if
     i32.const 2
     local.set $3
    else
     local.get $19
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 2
       local.set $0
      else
       i32.const 2
       local.set $6
      end
     else
      local.get $19
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 2
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 2
         local.set $2
        else
         i32.const 2
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $8
   i32.const 4
   i32.eq
   if
    i32.const 1
    local.set $5
   else
    local.get $8
    i32.const 3
    i32.eq
    if
     i32.const 1
     local.set $3
    else
     local.get $8
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 1
       local.set $0
      else
       i32.const 1
       local.set $6
      end
     else
      local.get $8
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 1
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 1
         local.set $2
        else
         i32.const 1
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $18
   i32.const 4
   i32.eq
   if
    i32.const 0
    local.set $5
   else
    local.get $18
    i32.const 3
    i32.eq
    if
     i32.const 0
     local.set $3
    else
     local.get $18
     i32.const 2
     i32.eq
     if
      local.get $0
      i32.const 0
      i32.lt_s
      if
       i32.const 0
       local.set $0
      else
       i32.const 0
       local.set $6
      end
     else
      local.get $18
      i32.const 1
      i32.eq
      if
       local.get $1
       i32.const 0
       i32.lt_s
       if
        i32.const 0
        local.set $1
       else
        local.get $2
        i32.const 0
        i32.lt_s
        if
         i32.const 0
         local.set $2
        else
         i32.const 0
         local.set $7
        end
       end
      end
     end
    end
   end
   local.get $5
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $5
    i32.const 4
    i32.shl
    i32.const 7340032
    i32.or
    local.get $1
    local.get $0
    local.get $3
    local.get $0
    i32.const 0
    i32.ge_s
    select
    local.get $1
    i32.const 0
    i32.ge_s
    select
    i32.or
    return
   end
   local.get $0
   local.get $3
   i32.or
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $3
    i32.const 4
    i32.shl
    i32.const 6291456
    i32.or
    local.get $0
    i32.or
    return
   end
   local.get $3
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $3
    i32.const 8
    i32.shl
    i32.const 3145728
    i32.or
    local.get $1
    i32.const 4
    i32.shl
    i32.or
    local.get $2
    i32.or
    return
   end
   local.get $0
   local.get $6
   i32.or
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $0
    i32.const 8
    i32.shl
    i32.const 2097152
    i32.or
    local.get $6
    i32.const 4
    i32.shl
    i32.or
    local.get $1
    i32.or
    return
   end
   local.get $0
   i32.const 0
   i32.ge_s
   if
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    local.get $0
    i32.const 12
    i32.shl
    i32.const 1048576
    i32.or
    local.get $1
    i32.const 8
    i32.shl
    i32.or
    local.get $2
    i32.const 4
    i32.shl
    i32.or
    local.get $7
    i32.or
    return
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   i32.const 0
   return
  end
  local.get $0
  local.get $4
  i32.const 2
  i32.shl
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/initTables
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $assembly/index/initialized
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  loop $for-loop|0
   local.get $2
   i32.const 8192
   i32.lt_s
   if
    block $for-continue|0
     local.get $2
     local.get $2
     i32.const 1
     i32.shr_s
     i32.const 1431655765
     i32.and
     i32.sub
     local.tee $0
     i32.const 858993459
     i32.and
     local.get $0
     i32.const 2
     i32.shr_s
     i32.const 858993459
     i32.and
     i32.add
     local.tee $0
     i32.const 4
     i32.shr_u
     local.get $0
     i32.add
     i32.const 252645135
     i32.and
     local.tee $0
     i32.const 8
     i32.shr_u
     local.get $0
     i32.add
     local.tee $0
     i32.const 16
     i32.shr_s
     local.get $0
     i32.add
     i32.const 63
     i32.and
     i32.const 5
     i32.ne
     if
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/FLUSH_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      i32.const 0
      i32.store
      br $for-continue|0
     end
     i32.const -1
     local.set $1
     i32.const 9
     local.set $0
     loop $for-loop|1
      local.get $0
      i32.const 0
      i32.ge_s
      if
       block $for-break1
        global.get $~lib/memory/__stack_pointer
        i32.const 1568
        i32.store
        local.get $2
        local.get $0
        i32.const 2
        i32.shl
        i32.const 1568
        i32.add
        i32.load
        i32.eq
        if
         local.get $0
         local.set $1
         br $for-break1
        end
        local.get $0
        i32.const 1
        i32.sub
        local.set $0
        br $for-loop|1
       end
      end
     end
     local.get $1
     i32.const 0
     i32.ge_s
     if
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/FLUSH_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $1
      i32.const 8388608
      i32.or
      i32.store
     else
      local.get $2
      local.set $0
      i32.const 0
      local.set $4
      i32.const 0
      local.set $5
      loop $for-loop|2
       local.get $5
       i32.const 5
       i32.lt_s
       if
        i32.const 0
        local.set $3
        local.get $0
        i32.const 256
        i32.ge_s
        if (result i32)
         i32.const 8
         local.set $3
         local.get $0
         i32.const 8
         i32.shr_s
        else
         local.get $0
        end
        local.tee $1
        i32.const 16
        i32.ge_s
        if
         local.get $3
         i32.const 4
         i32.add
         local.set $3
         local.get $1
         i32.const 4
         i32.shr_s
         local.set $1
        end
        local.get $1
        i32.const 4
        i32.ge_s
        if
         local.get $3
         i32.const 2
         i32.add
         local.set $3
         local.get $1
         i32.const 2
         i32.shr_s
         local.set $1
        end
        local.get $3
        i32.const 1
        i32.add
        local.get $3
        local.get $1
        i32.const 2
        i32.ge_s
        select
        local.tee $1
        local.get $4
        i32.const 13
        i32.mul
        i32.add
        local.set $4
        local.get $0
        i32.const -2
        local.get $1
        i32.rotl
        i32.and
        local.set $0
        local.get $5
        i32.const 1
        i32.add
        local.set $5
        br $for-loop|2
       end
      end
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/FLUSH_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $4
      i32.const 5242880
      i32.or
      i32.store
     end
    end
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  i32.const 0
  local.set $2
  loop $for-loop|3
   local.get $2
   i32.const 8192
   i32.lt_s
   if
    block $for-continue|3
     local.get $2
     local.get $2
     i32.const 1
     i32.shr_s
     i32.const 1431655765
     i32.and
     i32.sub
     local.tee $0
     i32.const 858993459
     i32.and
     local.get $0
     i32.const 2
     i32.shr_s
     i32.const 858993459
     i32.and
     i32.add
     local.tee $0
     i32.const 4
     i32.shr_u
     local.get $0
     i32.add
     i32.const 252645135
     i32.and
     local.tee $0
     i32.const 8
     i32.shr_u
     local.get $0
     i32.add
     local.tee $0
     i32.const 16
     i32.shr_s
     local.get $0
     i32.add
     i32.const 63
     i32.and
     i32.const 5
     i32.ne
     if
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/UNIQUE5_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      i32.const 0
      i32.store
      br $for-continue|3
     end
     i32.const -1
     local.set $1
     i32.const 9
     local.set $0
     loop $for-loop|4
      local.get $0
      i32.const 0
      i32.ge_s
      if
       block $for-break4
        global.get $~lib/memory/__stack_pointer
        i32.const 1568
        i32.store
        local.get $2
        local.get $0
        i32.const 2
        i32.shl
        i32.const 1568
        i32.add
        i32.load
        i32.eq
        if
         local.get $0
         local.set $1
         br $for-break4
        end
        local.get $0
        i32.const 1
        i32.sub
        local.set $0
        br $for-loop|4
       end
      end
     end
     local.get $1
     i32.const 0
     i32.ge_s
     if
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/UNIQUE5_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $1
      i32.const 4194304
      i32.or
      i32.store
     else
      local.get $2
      local.set $0
      i32.const 0
      local.set $4
      i32.const 0
      local.set $5
      loop $for-loop|5
       local.get $5
       i32.const 5
       i32.lt_s
       if
        i32.const 0
        local.set $3
        local.get $0
        i32.const 256
        i32.ge_s
        if (result i32)
         i32.const 8
         local.set $3
         local.get $0
         i32.const 8
         i32.shr_s
        else
         local.get $0
        end
        local.tee $1
        i32.const 16
        i32.ge_s
        if
         local.get $3
         i32.const 4
         i32.add
         local.set $3
         local.get $1
         i32.const 4
         i32.shr_s
         local.set $1
        end
        local.get $1
        i32.const 4
        i32.ge_s
        if
         local.get $3
         i32.const 2
         i32.add
         local.set $3
         local.get $1
         i32.const 2
         i32.shr_s
         local.set $1
        end
        local.get $3
        i32.const 1
        i32.add
        local.get $3
        local.get $1
        i32.const 2
        i32.ge_s
        select
        local.tee $1
        local.get $4
        i32.const 13
        i32.mul
        i32.add
        local.set $4
        local.get $0
        i32.const -2
        local.get $1
        i32.rotl
        i32.and
        local.set $0
        local.get $5
        i32.const 1
        i32.add
        local.set $5
        br $for-loop|5
       end
      end
      global.get $~lib/memory/__stack_pointer
      global.get $assembly/index/UNIQUE5_TABLE
      local.tee $0
      i32.store
      local.get $0
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $4
      i32.store
     end
    end
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|3
   end
  end
  i32.const 1
  global.set $assembly/index/initialized
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/setPlayerHand (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/index/playerHands
  local.tee $3
  i32.store
  local.get $0
  i32.const 5
  i32.mul
  local.get $1
  i32.add
  i32.const 2
  i32.shl
  local.get $3
  i32.add
  local.get $2
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/setPlayerLen (param $0 i32) (param $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/index/playerLens
  local.tee $2
  i32.store
  local.get $0
  i32.const 2
  i32.shl
  local.get $2
  i32.add
  local.get $1
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/setBoardCard (param $0 i32) (param $1 i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/index/board
  local.tee $2
  i32.store
  local.get $0
  i32.const 2
  i32.shl
  local.get $2
  i32.add
  local.get $1
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/buildDeck (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 0
  global.set $assembly/index/deckLen
  loop $for-loop|0
   local.get $2
   i32.const 32
   i32.lt_s
   if
    local.get $0
    i32.const 1
    local.get $2
    i32.shl
    i32.and
    i32.eqz
    if
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/deck
     local.tee $3
     i32.store
     local.get $3
     global.get $assembly/index/deckLen
     i32.const 2
     i32.shl
     i32.add
     local.get $2
     i32.store
     global.get $assembly/index/deckLen
     i32.const 1
     i32.add
     global.set $assembly/index/deckLen
    end
    local.get $2
    i32.const 1
    i32.add
    local.set $2
    br $for-loop|0
   end
  end
  i32.const 0
  local.set $0
  loop $for-loop|1
   local.get $0
   i32.const 20
   i32.lt_s
   if
    local.get $1
    i32.const 1
    local.get $0
    i32.shl
    i32.and
    i32.eqz
    if
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/deck
     local.tee $2
     i32.store
     local.get $2
     global.get $assembly/index/deckLen
     i32.const 2
     i32.shl
     i32.add
     local.get $0
     i32.const 32
     i32.add
     i32.store
     global.get $assembly/index/deckLen
     i32.const 1
     i32.add
     global.set $assembly/index/deckLen
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|1
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/calculate (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 1960
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store offset=8
   i32.const 5
   global.get $assembly/index/boardLen
   i32.sub
   local.set $8
   global.get $~lib/memory/__stack_pointer
   i32.const 5
   call $~lib/staticarray/StaticArray<i32>#constructor
   local.tee $15
   i32.store
   loop $for-loop|0
    local.get $2
    global.get $assembly/index/boardLen
    i32.lt_s
    if
     global.get $~lib/memory/__stack_pointer
     local.get $15
     i32.store offset=4
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/board
     local.tee $3
     i32.store offset=8
     local.get $2
     i32.const 2
     i32.shl
     local.tee $1
     local.get $15
     i32.add
     local.get $1
     local.get $3
     i32.add
     i32.load
     i32.store
     local.get $2
     i32.const 1
     i32.add
     local.set $2
     br $for-loop|0
    end
   end
   i32.const 0
   local.set $2
   loop $for-loop|1
    local.get $2
    global.get $assembly/index/numPlayers
    i32.lt_s
    if
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/wins
     local.tee $1
     i32.store offset=4
     local.get $2
     i32.const 2
     i32.shl
     local.tee $3
     local.get $1
     i32.add
     i32.const 0
     i32.store
     global.get $~lib/memory/__stack_pointer
     global.get $assembly/index/ties
     local.tee $1
     i32.store offset=4
     local.get $1
     local.get $3
     i32.add
     i32.const 0
     i32.store
     local.get $2
     i32.const 1
     i32.add
     local.set $2
     br $for-loop|1
    end
   end
   loop $for-loop|2
    local.get $0
    local.get $12
    i32.gt_s
    if
     i32.const 0
     local.set $17
     loop $for-loop|3
      local.get $8
      local.get $17
      i32.gt_s
      if
       global.get $assembly/index/seed
       i32.const 1103515245
       i32.mul
       i32.const 12345
       i32.add
       global.set $assembly/index/seed
       local.get $17
       global.get $assembly/index/seed
       global.get $assembly/index/deckLen
       local.get $17
       i32.sub
       i32.rem_u
       i32.add
       local.set $5
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/deck
       local.tee $1
       i32.store offset=4
       local.get $1
       local.get $17
       i32.const 2
       i32.shl
       local.tee $4
       i32.add
       i32.load
       local.set $3
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/deck
       local.tee $2
       i32.store offset=4
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/deck
       local.tee $1
       i32.store offset=8
       local.get $2
       local.get $4
       i32.add
       local.get $5
       i32.const 2
       i32.shl
       local.tee $2
       local.get $1
       i32.add
       i32.load
       i32.store
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/deck
       local.tee $1
       i32.store offset=4
       local.get $1
       local.get $2
       i32.add
       local.get $3
       i32.store
       global.get $~lib/memory/__stack_pointer
       local.get $15
       i32.store offset=4
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/deck
       local.tee $1
       i32.store offset=8
       local.get $15
       global.get $assembly/index/boardLen
       local.get $17
       i32.add
       i32.const 2
       i32.shl
       i32.add
       local.get $1
       local.get $4
       i32.add
       i32.load
       i32.store
       local.get $17
       i32.const 1
       i32.add
       local.set $17
       br $for-loop|3
      end
     end
     i32.const 0
     local.set $13
     i32.const 0
     local.set $17
     loop $for-loop|4
      local.get $17
      global.get $assembly/index/numPlayers
      i32.lt_s
      if
       global.get $~lib/memory/__stack_pointer
       local.get $15
       i32.store offset=4
       i32.const 0
       local.set $16
       global.get $~lib/memory/__stack_pointer
       i32.const 8
       i32.sub
       global.set $~lib/memory/__stack_pointer
       global.get $~lib/memory/__stack_pointer
       i32.const 1960
       i32.lt_s
       br_if $folding-inner0
       global.get $~lib/memory/__stack_pointer
       i64.const 0
       i64.store
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/playerLens
       local.tee $1
       i32.store
       local.get $1
       local.get $17
       i32.const 2
       i32.shl
       i32.add
       i32.load
       local.set $11
       local.get $17
       i32.const 5
       i32.mul
       local.set $10
       i32.const 0
       local.set $2
       loop $for-loop|00
        local.get $16
        i32.const 10
        i32.lt_s
        if
         global.get $~lib/memory/__stack_pointer
         i32.const 1632
         i32.store
         local.get $16
         i32.const 2
         i32.shl
         local.tee $1
         i32.const 1632
         i32.add
         i32.load
         local.set $9
         global.get $~lib/memory/__stack_pointer
         i32.const 1696
         i32.store
         local.get $1
         i32.const 1696
         i32.add
         i32.load
         local.tee $7
         local.get $11
         i32.ge_s
         local.get $9
         local.get $11
         i32.ge_s
         i32.or
         i32.eqz
         if
          i32.const 0
          local.set $14
          loop $for-loop|11
           local.get $14
           i32.const 10
           i32.lt_s
           if
            global.get $~lib/memory/__stack_pointer
            global.get $assembly/index/playerHands
            local.tee $1
            i32.store
            local.get $1
            local.get $9
            local.get $10
            i32.add
            i32.const 2
            i32.shl
            i32.add
            i32.load
            global.get $~lib/memory/__stack_pointer
            global.get $assembly/index/playerHands
            local.tee $1
            i32.store
            local.get $1
            local.get $7
            local.get $10
            i32.add
            i32.const 2
            i32.shl
            i32.add
            i32.load
            global.get $~lib/memory/__stack_pointer
            local.get $15
            i32.store
            global.get $~lib/memory/__stack_pointer
            i32.const 1760
            i32.store offset=4
            local.get $15
            local.get $14
            i32.const 2
            i32.shl
            local.tee $4
            i32.const 1760
            i32.add
            i32.load
            i32.const 2
            i32.shl
            i32.add
            i32.load
            global.get $~lib/memory/__stack_pointer
            local.get $15
            i32.store
            global.get $~lib/memory/__stack_pointer
            i32.const 1824
            i32.store offset=4
            local.get $15
            local.get $4
            i32.const 1824
            i32.add
            i32.load
            i32.const 2
            i32.shl
            i32.add
            i32.load
            global.get $~lib/memory/__stack_pointer
            local.get $15
            i32.store
            global.get $~lib/memory/__stack_pointer
            i32.const 1888
            i32.store offset=4
            local.get $15
            local.get $4
            i32.const 1888
            i32.add
            i32.load
            i32.const 2
            i32.shl
            i32.add
            i32.load
            call $assembly/index/eval5
            local.tee $1
            local.get $2
            i32.gt_s
            if
             local.get $1
             local.set $2
            end
            local.get $14
            i32.const 1
            i32.add
            local.set $14
            br $for-loop|11
           end
          end
         end
         local.get $16
         i32.const 1
         i32.add
         local.set $16
         br $for-loop|00
        end
       end
       global.get $~lib/memory/__stack_pointer
       i32.const 8
       i32.add
       global.set $~lib/memory/__stack_pointer
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/scores
       local.tee $1
       i32.store offset=4
       local.get $1
       local.get $17
       i32.const 2
       i32.shl
       i32.add
       local.get $2
       i32.store
       local.get $2
       local.get $13
       local.get $2
       local.get $13
       i32.gt_s
       select
       local.set $13
       local.get $17
       i32.const 1
       i32.add
       local.set $17
       br $for-loop|4
      end
     end
     i32.const 0
     local.set $2
     i32.const 0
     local.set $17
     loop $for-loop|5
      local.get $17
      global.get $assembly/index/numPlayers
      i32.lt_s
      if
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/scores
       local.tee $1
       i32.store offset=4
       local.get $2
       i32.const 1
       i32.add
       local.get $2
       local.get $13
       local.get $1
       local.get $17
       i32.const 2
       i32.shl
       i32.add
       i32.load
       i32.eq
       select
       local.set $2
       local.get $17
       i32.const 1
       i32.add
       local.set $17
       br $for-loop|5
      end
     end
     i32.const 0
     local.set $17
     loop $for-loop|6
      local.get $17
      global.get $assembly/index/numPlayers
      i32.lt_s
      if
       global.get $~lib/memory/__stack_pointer
       global.get $assembly/index/scores
       local.tee $1
       i32.store offset=4
       local.get $13
       local.get $1
       local.get $17
       i32.const 2
       i32.shl
       local.tee $4
       i32.add
       i32.load
       i32.eq
       if
        local.get $2
        i32.const 1
        i32.eq
        if
         global.get $~lib/memory/__stack_pointer
         global.get $assembly/index/wins
         local.tee $3
         i32.store offset=4
         global.get $~lib/memory/__stack_pointer
         global.get $assembly/index/wins
         local.tee $1
         i32.store offset=8
         local.get $3
         local.get $4
         i32.add
         local.get $1
         local.get $4
         i32.add
         i32.load
         i32.const 1
         i32.add
         i32.store
        else
         global.get $~lib/memory/__stack_pointer
         global.get $assembly/index/ties
         local.tee $4
         i32.store offset=4
         global.get $~lib/memory/__stack_pointer
         global.get $assembly/index/ties
         local.tee $3
         i32.store offset=8
         local.get $17
         i32.const 2
         i32.shl
         local.tee $1
         local.get $4
         i32.add
         local.get $1
         local.get $3
         i32.add
         i32.load
         i32.const 1
         i32.add
         i32.store
        end
       end
       local.get $17
       i32.const 1
       i32.add
       local.set $17
       br $for-loop|6
      end
     end
     local.get $12
     i32.const 1
     i32.add
     local.set $12
     br $for-loop|2
    end
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 34752
  i32.const 34800
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $assembly/index/getWins (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/index/wins
  local.tee $1
  i32.store
  local.get $0
  i32.const 2
  i32.shl
  local.get $1
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/index/getTies (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  global.get $assembly/index/ties
  local.tee $1
  i32.store
  local.get $0
  i32.const 2
  i32.shl
  local.get $1
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/staticarray/StaticArray<i32>#constructor (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 1960
  i32.lt_s
  if
   i32.const 34752
   i32.const 34800
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $0
  i32.const 268435455
  i32.gt_u
  if
   i32.const 1056
   i32.const 1104
   i32.const 51
   i32.const 60
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.const 2
  i32.shl
  call $~lib/rt/itcms/__new
  local.tee $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
)
