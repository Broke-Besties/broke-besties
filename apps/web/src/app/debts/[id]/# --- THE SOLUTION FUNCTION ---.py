# --- THE SOLUTION FUNCTION ---
def solve(boxes_a, boxes_b, boxes_c):
    # 1. Internal State Simulation
    stacks = {'A': list(boxes_a), 'B': list(boxes_b), 'C': list(boxes_c)}
    commands = []

    # 2. Target State: Sorted Descending
    all_boxes = sorted(stacks['A'] + stacks['B'] + stacks['C'], reverse=True)

    # Helper: Move
    def move(src, dst):
        if not stacks[src]: return
        val = stacks[src].pop()
        stacks[dst].append(val)
        commands.append(f"{src} {dst}")

    # Helper: Get Depth (0 = top)
    def get_depth(stack, target):
        for i in range(len(stack) - 1, -1, -1):
            if stack[i] == target:
                return (len(stack) - 1) - i
        return 9999

    # 3. Lock Correct Base
    locked_height = 0
    for i in range(len(stacks['A'])):
        if i < len(all_boxes) and stacks['A'][i] == all_boxes[i]:
            locked_height += 1
        else:
            break

    # 4. Smart Eviction
    next_target = all_boxes[locked_height] if locked_height < len(all_boxes) else None

    while len(stacks['A']) > locked_height:
        dist_b = get_depth(stacks['B'], next_target)
        dist_c = get_depth(stacks['C'], next_target)

        if dist_b < dist_c:
             move('A', 'C')
        else:
             move('A', 'B')

    # 5. Build Stack
    for i in range(locked_height, len(all_boxes)):
        target_val = all_boxes[i]
        
        dist_b = get_depth(stacks['B'], target_val)
        dist_c = get_depth(stacks['C'], target_val)

        if dist_b <= dist_c:
            source, temp = 'B', 'C'
        else:
            source, temp = 'C', 'B'

        while stacks[source][-1] != target_val:
            move(source, temp)
            
        move(source, 'A')

    return commands

# --- TEST RUNNER ---
def run_test(name, a, b, c):
    print(f"--- Test: {name} ---")
    print(f"Input: A={a}, B={b}, C={c}")
    
    # Run the solution
    # Note: We pass copies so the original lists aren't modified for the print statements
    cmds = solve(list(a), list(b), list(c))
    
    # Simulate the result to verify correctness
    sim_a, sim_b, sim_c = list(a), list(b), list(c)
    stacks = {'A': sim_a, 'B': sim_b, 'C': sim_c}
    
    for cmd in cmds:
        src, dst = cmd.split()
        val = stacks[src].pop()
        stacks[dst].append(val)

    # Validation Checks
    target = sorted(a + b + c, reverse=True)
    is_sorted = (sim_a == target)
    is_empty = (len(sim_b) == 0 and len(sim_c) == 0)
    count_ok = (len(cmds) <= 200)

    print(f"Commands: {len(cmds)} used")
    
    if is_sorted and is_empty and count_ok:
        print("✅ PASS")
    else:
        print("❌ FAIL")
        if not is_sorted: print(f"   Expected A: {target}")
        if not is_sorted: print(f"   Actual A:   {sim_a}")
        if not count_ok:  print(f"   Too many moves! ({len(cmds)})")
    print("")

if __name__ == "__main__":
    # Case 1: The "Moving Target" (Target is buried in A)
    # Goal: [20, 10]. 20 is in B. 10 is hidden in A under 5.
    # Code must move 5->B, realize 10 is next, then protect 10 by moving 5->C.
    run_test("Hidden Target", [10, 5], [20], [])

    # Case 2: Duplicates
    # Goal: [10, 10, 5]. Code should pick the easiest 10 first.
    run_test("Duplicates", [5], [10], [10])

    # Case 3: Presorted Base
    # Goal: [50, 40, 30]. 50 is already correct.
    run_test("Presorted Base", [50, 10], [40], [30])

    # Case 4: Complex Random
    run_test("Complex", [1, 5, 8], [2, 6, 9], [3, 4, 7])