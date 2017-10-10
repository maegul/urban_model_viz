
d3.queue()
    .defer(d3.csv, 'loc_1_var.csv', function(d){
    	return _.mapValues(d, function(o, k){
    		return (k != 'Land_Use_Element_Estimates') ? +o : o
    	})
    })
    .defer(d3.csv, 'input_sets.csv', function(d){
    	return {
    		input: d.input,
    		group: d.group,
    		mean: +d.mean
    	}
    })
    .defer(d3.csv, 'input_keys.csv')
    .defer(d3.csv, 'output_keys.csv')
    .await(ready);


function ready(error, data, inputs, inpt_keys, outpt_keys){


// Sort Data

	// Take out constants into separate object
	var data_constants = _.chain(data)
							.filter(d=>d['Land_Use_Element_Estimates'] == 'Constant')
							.get(0)
							.value()

	// Sort by Land_Use... and filter out the Constants

	// Purpose of sorting by Land_use... is so that the order of in vars and out vars lines up
	// This is relied on in the gen_output_proto() function
	// This presumes that the labelling of in vars is identical in loc_1_var and input_sets
	// Below this is explictly checked
	var data_sorted = _.chain(data)
						.filter(d=>d['Land_Use_Element_Estimates'] != 'Constant')
						.sortBy(['Land_Use_Element_Estimates'])
						.value();


	// Get variables

	console.log('data', data);
	console.log('inputs', inputs)
	console.log('input_keys', inpt_keys)
	console.log('output_keys', outpt_keys)

	var user_inputs_copy = JSON.parse(JSON.stringify(inputs.filter(i=>i.group == 'User')))


	console.log('data sorted', data_sorted);

	console.log(Object.keys(data[0]));


	// Inputs

	var input_groups = _.chain(inputs)
						.map(i=>i.group)
						.uniq()
						.sortBy()
						.value();

	console.log('groups', input_groups)

	console.log('User', inputs.filter(i=>i.group == 'User'))





	var cat_col_scale = d3.scale.category10();
	var cat_cols = d3.range(10).map(n => cat_col_scale(n))

	// var cat_cols = d3.schemeDark2;

	var uniMelb_cols = ['#d2f1cf', '#e5e1dc', '#e1eaf5', '#82a1bd', '#fffbcc'];


	// Creates object for binding color set to the data set
	// Pass in an array of colors as second argument to change color palette
	var group_col_bind = gen_group_color_bind(input_groups, cat_cols);

	console.log('group color bind', group_col_bind);


	var in_vars = data.map(r => r.Land_Use_Element_Estimates);
	in_vars = in_vars.slice(0, in_vars.length-1) // Not include constant
	console.log('in_var', in_vars)

	var in_vars_sorted = _.sortBy(in_vars);
	console.log('sorted in var', in_vars_sorted);



	// Check input vars in inputs match those of the model

	input_fields_check = [];
	console.log('input check')

	input_groups.forEach(function(g){

		var input_fields = _.chain(inputs)
						.filter(i=>i.group == g)
						.map(i=>i.input)
						.sortBy()
						.value();

		var check;



		if (in_vars_sorted.join(',') == input_fields.join(',')) {
			check = 'passed';
		} else {
			check = 'failed';
		}

		input_fields_check.push(check);
	})


	console.log('input fields check', input_fields_check);


	// Get output variables from column headers, excluding the 'Land Use ...'
	var out_vars = Object.keys(data[0]);
	out_vars_sorted = _.chain(out_vars)
						.filter(ov=>ov != 'Land_Use_Element_Estimates')
						.sortBy()
						.value();


	// Create object of factors for each output variable
	var loc_1 = {};

	// For each out var, array of factors in order of in var
	out_vars_sorted.forEach(function(ov){
		loc_1[ov] = data_sorted.map(function(r){
			return parseFloat(r[ov]);
		})
	})

	console.log('loc_1')
	console.log(loc_1)


	// Base Axis ranges

	var base_input = gen_input_dat(inputs);
	var dims_keys_input = _.keys(base_input[0]).filter(k=>k!='name');

	var input_base_range = {};
	dims_keys_input.forEach(function(dk){
		input_base_range[dk] = d3.extent(base_input.map(o => o[dk]));

	})


	var base_output = gen_output_proto(inputs);
	var dims_keys_output = _.keys(base_output[0]).filter(k=>k!='name');

	var output_base_range = {};
	dims_keys_output.forEach(function(dk){
		output_base_range[dk] = d3.extent(base_output.map(o => o[dk]));

	})


	// Set up Input Group Sel

	// Master Vars

	var sel_group = 'User';

	var group_input_dat = get_group_input_dat();

	function get_group_input_dat(){
		if (sel_group == 'User') {
			var group_input_dat = _.cloneDeep(user_inputs_copy)
		} 
		else {
			var group_input_dat = _.chain(inputs)
								.filter({group: sel_group})
								.cloneDeep()
								.value();
		}

		return group_input_dat;
	}

	function set_user_group_dat(){

		in_vars_sorted.forEach(function(iv){
			_.filter(inputs, {input: iv, group: 'User'})[0]['mean'] = _.filter(group_input_dat, {input: iv})[0]['mean']
		})
	}


	// Selector

	$('#user_group_sel').select2({
		placeholder: 'Select a group',
		data: input_groups.map(function(g){

			return (g == 'User')? 
				{id: g, text: 'Default', selected: true} : 
				{id: g, text: g}
	
		})
	})


	$('#user_group_sel').on('select2:select', function(e){

		sel_group = e.params.data.id;

		console.log('selected group', sel_group);

		group_input_dat = get_group_input_dat();
		set_user_group_dat();

		gen_input_spinners();
		update();

	})


	d3.select('#reset_user_group').on('click', function(){
		set_user_group_dat();

		gen_input_spinners();
		update();
	})



	// Set up Input Spinners


	gen_input_spinners();

	function gen_input_spinners(){

		var spinner_div = d3.select('#spinners'); // General location for user inputs

		spinner_div.selectAll('*').remove();

		var base_inpts = _.filter(inputs, {group: 'User'});

		console.log('base inpts', base_inpts);

		in_vars_sorted.forEach(function(iv, i){

			// console.log('in_var_for_each', iv)

			var base_val = _.chain(base_inpts)
				.filter({input: iv})
				.get('[0]mean')
				.value();

			// var step_val = 0.1 * (input_base_range[iv][1] - input_base_range[iv][0])

			var iv_key = _.chain(inpt_keys)
						.filter({input: iv})
						.get('[0]key')
						.value()

			var iv_desc = _.chain(inpt_keys)
						.filter({input: iv})
						.get('[0]desc')
						.value()

		

			spinner_div.append('div').classed('inpt_cont', true)
					.attr('in_var_key', iv_key)
					.append('label').classed('inpt_spin_lab', true)
					.attr('for', 'input_'+i)
					.text(iv_desc +' :  ')

			spinner_div.select('div:last-child').append('input')
				.classed('inpt_spin', true)
				.attr('id', 'input_'+i)
				.style('width', '3em')

			$('#input_'+i).spinner()
			$('#input_'+i).spinner('value', function(){
				
				return base_val;
			})
			$('#input_'+i).spinner( "option", { index_bind: i,
												input_bind: iv, 
												min: 0,
												step: 1
												// step: step_val 
												} );

			$('#input_'+i).on('spin', function(event, ui){

				// console.log('change/spin')
				console.log('input_id', $('#input_'+i).spinner( "option", "input_bind" ))


				var in_var_bind = $('#input_'+i).spinner( "option", "input_bind" );

				_.filter(base_inpts, {input: in_var_bind})[0]['mean'] = ui.value;


				update();

			})

			$('#input_'+i).on('spinchange', function(event, ui){



				console.log('input_id', $('#input_'+i).spinner( "option", "input_bind" ))

				// var in_var_idx = $('#input_'+i).spinner( "option", "index_bind" );

				var in_var_bind = $('#input_'+i).spinner( "option", "input_bind" );

				_.filter(base_inpts, {input: in_var_bind})[0]['mean'] = $('#input_'+i).spinner('value');

				update();

			})

		})


	}



	// Set up Selector

	var sel_cont = d3.select('#area_sel_cont');

	input_groups.forEach(function(ig){

		var group_button;

		if (ig == 'User') {
			group_button = sel_cont.insert('button', ':first-child');
		} else {
			group_button = sel_cont.append('button');
		}
		group_button
			.text(ig)
			.attr('group', ig)
			.attr('sel', 1)
			.classed('sel_butt group_sel', true)
			.style('background-color', function(){
				return _.chain(group_col_bind)
						.filter({group: d3.select(this).attr('group')})
						.get('[0].color');
				// return _.filter(group_col_bind, {group: d3.select(this).attr('group')})[0]['color'];
			})
			.on('click', function(){

				var sel = d3.select(this).attr('sel')

				if (sel == 1) {
					d3.select(this)
						.attr('sel', 0)
						.style('opacity', 0.4)
				} else {
					d3.select(this)
						.attr('sel', 1)
						.style('opacity', 1)
				}


				update();
				
			})
	})






	// Sort Axes Numerically



	var dim_val_order = [];

	dims_keys_output.forEach(function(dk){

		var out_name_val = _.chain(base_output)
			.sortBy(o => o[dk])
			.map(o => o.name)
			.reverse() // First element is highest in value
			.value();

		dim_val_order.push({dim: dk, ord: out_name_val})


	})


	console.log('dim order', dim_val_order)

	var dim_sort_key = d3.range(dim_val_order[0]['ord'].length).map(function(idx){
									return '[ord][' + idx + ']'
								})

	var sorted_dims = _.chain(dim_val_order)
						.sortBy(dim_sort_key)
						.map(function(d, i){
							return {dim: d.dim, index: i}
						})
						.value();

	sorted_dims = _.zipObject(_.map(sorted_dims, 'dim'), _.map(sorted_dims, 'index'))

	console.log('sorted dims', sorted_dims)




	// Add sorting buttons

	//  Determines how output axes sorted
	var output_p_c_sort_param = 'abc'


	var sort_inpts = d3.select('#sort_select')
	sort_inpts.append('div').text('Sort output by:')
	var sort_sel_cont = sort_inpts.append('div');

	var sort_opts = ['ABC', 'Grouped']

	sort_opts.forEach(function(l){
		sort_sel_cont.append('button').classed('sel_butt', true)
			.text(l)
			.style('background-color', '#7F7F7F')
			.attr('sel', (l=='ABC') ? 1 : 0)
			.attr('sort_param', l.toLowerCase())
			.style('opacity', (l=='ABC') ? 1 : 0.4)
			.on('click', function(){

				var sel = d3.select(this).attr('sel')

				if (sel == 0) {

					d3.select(this.parentNode).selectAll('button')
						.attr('sel', 0)
						.style('opacity', 0.4)

					d3.select(this)
						.attr('sel', 1)
						.style('opacity', 1)


					output_p_c_sort_param = d3.select(this).attr('sort_param');
					update();

				}
			})
	})

	// sort_opts.forEach(function(l){
	// 	sort_inpts.append('input')
	// 		.attr('type', 'radio')
	// 		.attr('name', 'out_sort')
	// 		.attr('id', 'rad'+l)
	// 	sort_inpts.append('label')
	// 		.text(l)
	// 		.attr('for', 'rad'+l)

		// $('#rad'+l).checkboxradio();

	// })



	// Init


	update();

	console.log('input dat', gen_input_dat(inputs))
	// var output = gen_output();
	// gen_plot(output);


	// gen_p_coord_plot(output);



	// // For preserving the arrangement of the dimensions
	// var dim_order;




// Functions

// Update Func
function update(){

	// determine which groups to display
	var selected_groups = gen_selected_groups();


	// filter inputs for only the selected groups
	var new_input = _.filter(inputs, function(i){
		return _.findIndex(selected_groups, s => s == i.group) > -1;
	})



	var output = gen_output_proto(new_input);
	gen_p_coord_plot_proto(output);

	var input_dat = gen_input_dat(new_input);
	gen_p_coord_plot_input(input_dat);

	d3.selectAll('.label').attr('text-anchor', 'left').attr('transform', 'rotate(-65)')
}


function gen_selected_groups(){
	var selected_groups = []
	d3.selectAll('.group_sel').each(function(){
		var butt = d3.select(this);
		 if(butt.attr('sel') == 1){
		 	selected_groups.push(butt.attr('group'))
		 }
	})

	return selected_groups;
}


function color_select_pills(groups){

	groups.forEach(function(g){
		// Selecting select2 pill box
		d3.select('.select2-selection__rendered')
			.selectAll('.select2-selection__choice')
			.filter(function(){
				return d3.select(this).attr('title')==g
			})
			.style('border-color', function(){
				return group_col_bind.filter(gc=>gc.group==g)[0]['color']
			})
	})
}


function gen_group_color_bind(groups, cols){
	var group_col = [];

	groups
		.filter(g => g != 'User')
		.forEach(function(g, i){
		var gc_bind = {
				group: g,
				color: cols[i]
			};
		group_col.push(gc_bind);
	})

	group_col.push({
		group: 'User',
		color: 'black'
	})

	return group_col;
}



function gen_cat_col_scale(groups){

	var col_scale_vs = numeric.linspace(0, 1, groups.length);
	var col_scale_cs = groups.map(function(g){
		var col = group_col_bind.filter(gc=> gc.group == g)[0]['color']
		return col
	});

	var col_scale = col_scale_vs.map(function(v, i){
		return [v, col_scale_cs[i]]
	});

	console.log('cust cat scale', col_scale)
	console.log(col_scale_cs)

	return col_scale;

}


function gen_input_dat(input){

	var output = [];

	var groups = _.chain(input)
					.map(i=>i.group)
					.uniq()
					.sortBy()
					.value();

	groups.forEach(function(g){
		var output_d = {};

		output_d['name'] = g;

		var grouped_inputs = _.filter(inputs, {group: g});

		in_vars_sorted.forEach(function(iv){
			output_d[iv] = _.filter(grouped_inputs, {input: iv})[0]['mean']
		})

		output.push(output_d);
	})


	return output;

}

function gen_output_proto(input){


	// array - object for each out_var - out_var; values(for each input); ids;

	var output = [];

	// Get array of unique groups
	var groups = _.chain(input)
					.map(i=>i.group)
					.uniq()
					.sortBy()
					.value();



	// Calculate each group separately - each is separate object
	groups.forEach(function(g){

		var output_d = {};

		// Add group name to group object
		output_d['name'] = g;


		// Get input values for group
		// Sorting input values so that line up with model order
		// Get mean
		var input_values = _.chain(input)
							.filter(i=>i.group == g)
							.sortBy(i=>i.input)
							.map(i=>i.mean)
							.value()


		out_vars_sorted.forEach(function(ov){


			var new_value = math
					.chain(loc_1[ov]) // Use the factors for output variable
					.multiply(input_values) // Multiplies and sums products
					.add(data_constants[ov]) // Add constant
					.done()

			output_d[ov] = new_value;


		});

		// Push group object to output array
		output.push(output_d);

	}) 

	console.log('proto_output', output);

	return output;

}



// Axis range generation

function axis_round_up(x, f){
	var s = Math.sign(x);
	var s_adj = parseInt( Math.abs(((s+1)/2)) )

	return x + s*((f * s_adj) - s*(x % f ? x%f : s*f))

}

function axis_round_down(x, f){
	var s = Math.sign(x);
	var s_adj = parseInt( Math.abs(((s-1)/2)) )

	return x + s*((f * s_adj) - s*(x % f ? x%f : s*f))
}

function axis_find_factor(x){
	return 5*Math.pow(10, Math.floor( Math.log10( Math.abs(x) ) ))
}

function gen_p_coord_plot_input(output){

	console.log('input dat', output)


	d3.select('#parcoord_plot_inpt').selectAll('*').remove();


	var pc_out = d3.parcoords()('#parcoord_plot_inpt')
					.margin({left:5, top:100, bottom:5, right: 5})


	var dims_keys = _.keys(output[0]).filter(k=>k!='name');
	
	var range = pc_out.height() - pc_out.margin().top - pc_out.margin().bottom;


	var dims = {};
	dims_keys.forEach(function(dk){


		var user_val = _.chain(output)
						.filter(o => o.name == 'User')
						.get('[0]'+dk)
						.value();

		var extent = d3.extent(input_base_range[dk].concat(user_val))

		extent[0] =  axis_round_down(extent[0], axis_find_factor(extent[0]))
		extent[1] =  axis_round_up(extent[1], axis_find_factor(extent[1]))


		var scale_range = extent[1] - extent[0];
		var scale_buff = 0.1 * scale_range;

		extent = extent.map(function(e,i){
		  return e + ((i*2)-1) * scale_buff
		})


		var scale = d3.scale.linear().domain(extent).range([range, 1]);

		var title = _.chain(inpt_keys)
						.filter({input: dk})
						.get('[0]key')
						.value()


		dims[dk] = {title: title,
					yscale: scale}
	})


	pc_out.data(output)
		.dimensions(dims)




	pc_out.color(function(d){
		return _.filter(group_col_bind, {group: d.name})[0]['color'];
	})

	pc_out.lineWidth(5);

	console.log('dimensions', pc_out.dimensions())
	pc_out.smoothness(.08)

	pc_out.render()
	pc_out.createAxes();

	pc_out.reorderable();

	d3.select('#parcoord_plot_inpt').selectAll('.label').each(function(){
		var key_label = d3.select(this).text();

		var desc = _.chain(inpt_keys)
					.filter({key: key_label})
					.get('[0]desc')
					.value()

		d3.select(this.parentNode)
			.on('mouseover', function(){


				d3.selectAll('.inpt_cont')
					.filter(function(){
						return d3.select(this).attr('in_var_key') == key_label
					})
					.select('.inpt_spin_lab')
					.style('font-weight', 900)

			})
			.on('mouseout', function(){

				d3.selectAll('.inpt_spin_lab')
					.style('font-weight', 'initial')
			})


	})



}


function gen_p_coord_plot_proto(output){

	d3.select('#parcoord_plot').selectAll('*').remove();

	var pc_out = d3.parcoords()('#parcoord_plot')
					.margin({left:5, top:100, bottom:5, right: 5})

	var dims_keys = _.keys(output[0]).filter(k=>k!='name');

	var range = pc_out.height() - pc_out.margin().top - pc_out.margin().bottom;


	var dims = {};
	dims_keys.forEach(function(dk, i){


		// Add custom user value to base extent to expansion
		var user_val = _.chain(output)
						.filter(o => o.name == 'User')
						.get('[0]'+dk)
						.value();

		var extent = d3.extent(output_base_range[dk].concat(user_val))


		// console.log('out axis range', dk, JSON.stringify(output_base_range[dk].concat(user_val)))

		// extent[0] =  axis_round_down(extent[0], axis_find_factor(extent[0]))
		// extent[1] =  axis_round_up(extent[1], axis_find_factor(extent[1]))

		// console.log('after adjusting', extent)


		var scale_range = extent[1] - extent[0];
		var scale_buff = 0.2 * scale_range;

		extent = extent.map(function(e,i){
		  return e + ((i*2)-1) * scale_buff
		})


		var scale = d3.scale.linear().domain(extent).range([range, 1]);


		if (output_p_c_sort_param == 'abc') {

			var dim_index = i;

		} else if (output_p_c_sort_param == 'grouped') {

			dim_index = sorted_dims[dk]
		}


		var title = _.chain(outpt_keys)
						.filter({output: dk})
						.get('[0]key')
						.value()

		dims[dk] = {title: title,
					yscale: scale,
					index: dim_index
				}
	})


	
		pc_out.data(output)
				.dimensions(dims)
		



	pc_out.color(function(d){

		var bound_col = _.filter(group_col_bind, {group: d.name})[0]['color'];

		return bound_col
		
	})

	// pc_out.lineWidth(5);

	pc_out.lineWidth(5)

	pc_out.smoothness(.08)

	pc_out.render()
	pc_out.createAxes();

	pc_out.reorderable();


	d3.select('#parcoord_plot').selectAll('.label').each(function(){
		var key_label = d3.select(this).text();

		var desc = _.chain(outpt_keys)
					.filter({key: key_label})
					.get('[0]desc')
					.value()



	})


}






	function gen_output(){
		
		var output = [];

		out_vars_sorted.forEach(function(ov){

			var output_d = {};

			output_d[ov] = math
					.chain(loc_1[ov].slice(0, loc_1[ov].length-1)) // Constant (last) isn't factor
					.multiply(cnt_1) // Multiplies and sums products
					.add(loc_1[ov][loc_1[ov].length-1]) // Add constant
					.done()

			output.push(output_d)
		})

		console.log('output', output)

		return output;
	}
	// Sum over factors and input counts to create total output for each

	



	function gen_plot(output){

		var trace1 = {
			y: output.map(d=>_.keys(d)[0]),
			x: output.map(d=>_.values(d)[0]),//Object.keys(output).map(function(ov){return output[ov];}),
			type: 'bar',
			text: output.map(function(d){return math.round(_.values(d)[0], 2);}),
			textposition: 'auto',

			orientation: 'h'
		}

		var layout = {
		  // autosize: false,
		  // width: 500,
		  height: 600,
		  xaxis: {
		  	tickangle: 75
		  },
		  margin: {
		    l: 400,
		    r: 0,
		    b: 50,
		    t: 70,
		    pad: 4
		  }
		};

		Plotly.newPlot('plot1', [trace1], layout)

	}







function gen_p_coord_plot(output){

	console.log('output in p coord plot', output)

	// console.log('dims', dims)

	var trace = {
		type: 'parcoords',
		pad: [100, 100, 100, 100],

		dimensions: output.map(function(ov){
			var val = [_.values(ov)[0]];
			// var range = [math.round(val[0]*0, 0), math.round(val[0]*2, 0)];
			var range = [p_coord_ranges[_.keys(ov)[0]][0], p_coord_ranges[_.keys(ov)[0]][1]];
			// var range = [math.round(val - 2*val, 0),math.round(val + 2*val, 0) ];


			return {
				range: range,
				// range: [math.round(val*0, 0), math.round(val*2, 0)],
				// range: p_coord_ranges[_.keys(ov)[0]],
				// range: [math.round(val - 2*val, 0),math.round(val + 2*val, 0) ],
				label: _.keys(ov)[0].slice(0, 7),
				out_var_label: _.keys(ov)[0],
				values: val,


		}
	})
	}

	// var data = [{
	//   type: 'parcoords',
	//   pad: [80,80,80,80],
	//   line: {
	//     // color: unpack(rows, 'species_id'),
	//     // colorscale: [[0, 'red'], [0.5, 'green'], [1, 'blue']]
	//   },

	var layout = {
	  // width: 800
	};


	Plotly.newPlot('parcoord_plot', [trace], layout);
	
}




// End aSync function call back
}



